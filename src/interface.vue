<template>
	<v-notice
		v-if="!relationInfo || !relationInfo.junctionCollection.collection || !relationInfo.relatedCollection.collection"
		type="warning"
	>
		{{ t('relationship_not_setup') }}
	</v-notice>

	<v-notice v-else-if="!props.referencingField" type="warning full">
		<div>
			<p>{{ t('display_template_not_setup') }}</p>
			<ul>
				<li>
					<strong>{{ t('corresponding_field') }}</strong>
					<span>:&nbsp;</span>
					{{ t('errors.NOT_NULL_VIOLATION') }}
				</li>
			</ul>
		</div>
	</v-notice>

	<template v-else>
		<v-menu v-if="selectAllowed" v-model="menuActive" attached>
			<template #activator>
				<v-input
					v-model="localInput"
					:placeholder="placeholder || t('search_items')"
					:disabled="disabled"
					@keydown="onInputKeyDown"
					@focus="menuActive = true"
				>
					<template v-if="iconLeft" #prepend>
						<v-icon v-if="iconLeft" :name="iconLeft" />
					</template>

					<template #append>
						<v-icon v-if="iconRight" :name="iconRight" />
					</template>
				</v-input>
			</template>

			<v-list v-if="!disabled && (showAddCustom || suggestedItems.length)">
				<v-list-item v-if="showAddCustom" clickable @click="addItemFromInput">
					<v-list-item-content class="add-custom" v-tooltip="t('interfaces.tags.add_tags')">
						{{
							t('field_in_collection', {
								field: localInput,
								collection: t('create_item'),
							})
						}}
					</v-list-item-content>
				</v-list-item>

				<v-divider v-if="showAddCustom && suggestedItems.length" />

				<template v-if="suggestedItems.length">
					<v-list-item
						v-for="(item, index) in suggestedItems"
						:key="item[relationInfo.relatedPrimaryKeyField.field]"
						:active="index === suggestedItemsSelected"
						clickable
						@click="() => addItemFromSuggestion(item)"
					>
						<v-list-item-content>
							{{ item[props.referencingField] }}
						</v-list-item-content>
					</v-list-item>
				</template>
			</v-list>

			<v-list v-else-if="!disabled && localInput && !createAllowed">
				<v-list-item class="no-items">
					{{ t('no_items') }}
				</v-list-item>
			</v-list>
		</v-menu>

		<v-skeleton-loader v-if="loading" type="block-list-item" />

		<div v-else-if="sortedItems.length" class="tags">
			<v-chip
				v-for="item in sortedItems"
				:key="item[relationInfo.junctionField.field][props.referencingField]"
				:disabled="disabled || !selectAllowed"
				class="tag clickable"
				small
				label
				clickable
				v-tooltip="t('remove')"
				@click="deleteItem(item)"
			>
				{{ item[relationInfo.junctionField.field][props.referencingField] }}
			</v-chip>
		</div>
	</template>
</template>

<script lang="ts" setup>
import { computed, ref, toRefs, Ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { clone, debounce, partition } from 'lodash';
import { Filter } from '@directus/shared/types';
import { useApi, useStores } from '@directus/shared/composables';
import { parseFilter, getEndpoint } from '@directus/shared/utils';
import { useRelationM2M } from './use-relations';

type RelationItem = number | string | Record<string, any>;

const props = withDefaults(
	defineProps<{
		value?: RelationItem[];
		primaryKey: string | number;
		collection: string;
		field: string;
		placeholder?: string | null;
		disabled?: boolean;
		allowCustom?: boolean;
		filter?: Filter | null;
		referencingField: string | null;
		sortField?: string | null;
		sortDirection?: string | null;
		iconLeft?: string | null;
		iconRight?: string | null;
	}>(),
	{
		value: () => [],
		disabled: false,
		filter: () => null,
		allowCustom: true,
		sortDirection: 'desc',
		iconRight: 'local_offer',
	}
);

const emit = defineEmits(['input']);

const { t } = useI18n();
const { value, collection, field } = toRefs(props);
const { relationInfo } = useRelationM2M(collection, field, useStores());
const { usePermissionsStore, useUserStore } = useStores();
const { currentUser } = useUserStore();
const { hasPermission } = usePermissionsStore();

const createAllowed = computed(() => {
	if (currentUser?.role.admin_access === true) return true;
	if (!relationInfo.value || !props.allowCustom) return false;
	return (
		hasPermission(relationInfo.value.relatedCollection.collection, 'create') &&
		hasPermission(relationInfo.value.junctionCollection.collection, 'create')
	);
});

const selectAllowed = computed(() => {
	if (currentUser?.role.admin_access === true) return true;
	if (!relationInfo.value) return false;
	return hasPermission(relationInfo.value.junctionCollection.collection, 'create');
});

const localInput = ref<string>('');
const menuActive = ref<boolean>(false);
const suggestedItems = ref<Record<string, any>[]>([]);
const suggestedItemsSelected = ref<number | null>(null);
const api = useApi();

const fetchFields = [relationInfo.value?.relatedPrimaryKeyField.field];

if (props.referencingField && props.referencingField !== relationInfo.value?.relatedPrimaryKeyField.field) {
	fetchFields.push(props.referencingField);
}

const { items, loading } = usePreviews(value);
const sortedItems = computed(() => {
	if (!relationInfo.value?.junctionField?.field || !props.referencingField) return items.value;

	const sorted = clone(items.value).sort(
		(a: Record<string, Record<string, any>>, b: Record<string, Record<string, any>>) => {
			const aVal: string = a[relationInfo.value.junctionField.field][props.referencingField]?.toString() || '';
			const bVal: string = b[relationInfo.value.junctionField.field][props.referencingField]?.toString() || '';

			return props.sortDirection === 'desc' ? bVal.localeCompare(aVal) : aVal.localeCompare(bVal);
		}
	);

	return sorted;
});

const showAddCustom = computed(
	() =>
		createAllowed.value &&
		localInput.value?.trim() &&
		!itemValueAvailable(localInput.value) &&
		!itemValueStaged(localInput.value)
);

watch(
	localInput,
	debounce((val: string) => {
		refreshSuggestions(val);
		menuActive.value = true;
	}, 300)
);

function emitter(newVal: any[] | null) {
	emit('input', newVal);
}

function deleteItem(item: any) {
	if (value.value && !Array.isArray(value.value)) return;

	if (relationInfo.value.junctionPrimaryKeyField.field in item) {
		emitter(value.value.filter((x: any) => x !== item[relationInfo.value.junctionPrimaryKeyField.field]));
	} else {
		emitter(value.value.filter((x: any) => x !== item));
	}
}

function addItemFromSuggestion(item: any) {
	menuActive.value = false;
	emitter([...(props.value || []), { [relationInfo.value.junctionField.field]: item }]);
}

async function addItemFromInput() {
	if (!props.referencingField) return;

	const value = localInput.value?.trim();
	if (!value || itemValueStaged(value)) return;

	const cachedItem = suggestedItems.value.find((item) => item[props.referencingField] === value);
	if (cachedItem) {
		addItemFromSuggestion(cachedItem);
		return;
	}

	try {
		const item = await findByKeyword(value);
		if (item) {
			addItemFromSuggestion(item);
		} else if (createAllowed.value) {
			addItemFromSuggestion({ [props.referencingField]: value });
		}
		localInput.value = '';
	} catch (err: any) {
		window.console.warn(err);
	}
}

function itemValueStaged(value: string): boolean {
	if (!value || !props.referencingField) return false;
	return !!items.value.find((item) => item[relationInfo.value.junctionField.field][props.referencingField] === value);
}

function itemValueAvailable(value: string): boolean {
	if (!value || !props.referencingField) return false;
	return !!suggestedItems.value.find((item) => item[props.referencingField] === value);
}

async function refreshSuggestions(keyword: string) {
	suggestedItemsSelected.value = null;
	if (!keyword || keyword.length < 1) {
		suggestedItems.value = [];
		return;
	}

	const currentIds = items.value
		.map((i) => i[relationInfo.value.junctionField.field][relationInfo.value.relatedPrimaryKeyField.field])
		.filter((i) => !!i);

	const query = {
		params: {
			limit: 10,
			fields: fetchFields,
			filter: {
				_and: [
					props.filter && parseFilter(props.filter, null),
					currentIds.length > 0 && {
						[relationInfo.value.relatedPrimaryKeyField.field]: {
							_nin: currentIds.join(','),
						},
					},
					{
						[props.referencingField]: {
							_contains: keyword,
						},
					},
				].filter((x) => !!x),
			},
			sort: props.sortField
				? props.sortDirection === 'desc'
					? `-${props.sortField}`
					: props.sortField
				: `-${relationInfo.value.relatedPrimaryKeyField.field}`,
		},
	};

	const response = await api.get(getEndpoint(relationInfo.value.relatedCollection.collection), query);
	if (response?.data?.data && Array.isArray(response.data.data)) {
		suggestedItems.value = response.data.data;
	} else {
		suggestedItems.value = [];
	}
}

async function findByKeyword(keyword: string): Promise<Record<string, any> | null> {
	const response = await api.get(getEndpoint(relationInfo.value.relatedCollection.collection), {
		params: {
			limit: 1,
			fields: fetchFields,
			filter: {
				[props.referencingField]: {
					_eq: keyword,
				},
			},
		},
	});

	return response?.data?.data?.pop() || null;
}

function usePreviews(value: Ref<RelationItem[]>) {
	const items = ref<any[]>([]);
	const loading = ref<boolean>(value.value && value.value.length > 0);

	if (!relationInfo.value) return { items, loading };

	const relationalFetchFields = [
		relationInfo.value.junctionPrimaryKeyField.field,
		...fetchFields.map((field) => relationInfo.value.junctionField.field + '.' + field),
	];

	watch(
		value,
		debounce((value: RelationItem[]) => update(value), 300)
	);

	if (value.value && Array.isArray(value.value)) {
		update(value.value);
	}

	return { items, loading };

	async function update(value: RelationItem[]) {
		const [ids, staged] = partition(value || [], (x: RelationItem) => typeof x !== 'object');

		if (!ids.length) {
			items.value = [...staged];
			return;
		}

		const cached = items.value.filter(
			(x: Record<string, any>) =>
				typeof x === 'object' &&
				x[relationInfo.value.junctionPrimaryKeyField.field] &&
				ids.includes(x[relationInfo.value.junctionPrimaryKeyField.field])
		);

		if (cached.length === ids.length) {
			items.value = [...cached, ...staged];
			return;
		}

		loading.value = true;
		const response = await api.get(getEndpoint(relationInfo.value.junctionCollection.collection), {
			params: {
				fields: relationalFetchFields,
				limit: ids.length,
				filter: {
					id: {
						_in: ids,
					},
				},
			},
		});

		if (response?.data?.data && Array.isArray(response.data.data)) {
			items.value = [...response.data.data, ...staged];
		} else {
			items.value = [...staged];
		}

		loading.value = false;
	}
}

async function onInputKeyDown(event: KeyboardEvent) {
	if (event.key === 'Escape' && !menuActive.value && localInput.value) {
		localInput.value = '';
		return;
	}

	if (event.key === 'Escape') {
		event.preventDefault();
		menuActive.value = false;
		return;
	}

	if (event.key === 'Enter') {
		event.preventDefault();
		if (suggestedItemsSelected.value !== null && suggestedItems.value[suggestedItemsSelected.value]) {
			addItemFromSuggestion(suggestedItems.value[suggestedItemsSelected.value]);
			localInput.value = '';
		} else if (createAllowed.value) {
			addItemFromInput();
		}
		return;
	}

	if (event.key === 'ArrowUp' || (event.key === 'Tab' && event.shiftKey)) {
		event.preventDefault();
		if (suggestedItems.value.length < 1) return;
		// Select previous from the list, if on top, then go last.
		suggestedItemsSelected.value =
			suggestedItemsSelected.value === null ||
			suggestedItemsSelected.value < 1 ||
			!suggestedItems.value[suggestedItemsSelected.value]
				? suggestedItems.value.length - 1
				: suggestedItemsSelected.value - 1;
		return;
	}

	if (event.key === 'Tab') {
		if (!menuActive.value) {
			localInput.value = '';
			return;
		}

		if (!localInput.value && suggestedItems.value.length < 1) return;
	}

	if (event.key === 'ArrowDown' || event.key === 'Tab') {
		event.preventDefault();
		if (suggestedItems.value.length < 1) return;
		// Select next from the list, if bottom, then go first.
		suggestedItemsSelected.value =
			suggestedItemsSelected.value === null ||
			suggestedItemsSelected.value >= suggestedItems.value.length - 1 ||
			!suggestedItems.value[suggestedItemsSelected.value]
				? 0
				: suggestedItemsSelected.value + 1;
		return;
	}
}
</script>

<style scoped>
.add-custom {
	font-style: oblique;
}

.no-items {
	color: var(--foreground-subdued);
}

.tags {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	justify-content: flex-start;
	padding: 4px 0px 0px;
}

.tag {
	margin-top: 8px;
	margin-right: 8px;
	cursor: pointer;

	--v-chip-background-color: var(--primary);
	--v-chip-color: var(--foreground-inverted);
	--v-chip-background-color-hover: var(--danger);
	--v-chip-close-color: var(--v-chip-background-color);
	--v-chip-close-color-hover: var(--white);
	transition: all var(--fast) var(--transition);
}

.tag:hover {
	--v-chip-close-color: var(--white);
}
</style>
