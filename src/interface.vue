<template>
	<v-notice v-if="!junctionCollection || !relationCollection" type="warning">
		{{ t('relationship_not_setup') }}
	</v-notice>

	<v-notice v-else-if="!referencingField" type="warning full">
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
		<v-menu v-model="menuActive" :disabled="disabled" attached>
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

			<v-list v-if="showAddCustom || suggestedItems.length">
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
						:key="item[relatedPrimaryKeyField]"
						:active="index === suggestedItemsSelected"
						clickable
						@click="() => addItemFromSuggestion(item)"
					>
						<v-list-item-content>
							{{ item[referencingField] }}
						</v-list-item-content>
					</v-list-item>
				</template>
			</v-list>

			<v-list v-else-if="localInput && !createAllowed">
				<v-list-item class="no-items">
					{{ t('no_items') }}
				</v-list-item>
			</v-list>
		</v-menu>

		<div v-if="sortedItems.length" class="tags">
			<v-chip
				v-for="item in sortedItems"
				:key="item[junctionField][referencingField]"
				:disabled="disabled"
				class="tag clickable"
				small
				label
				clickable
				v-tooltip="t('remove')"
				@click="deleteItem(item)"
			>
				{{ item[junctionField][referencingField] }}
			</v-chip>
		</div>
	</template>
</template>

<script lang="ts">
import { computed, defineComponent, PropType, ref, toRefs, Ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { clone, debounce } from 'lodash';
import { Filter } from '@directus/shared/types';
import { useApi, useStores } from '@directus/shared/composables';
import { parseFilter, getEndpoint } from '@directus/shared/utils';
import { useRelationM2M } from './use-relations';

export default defineComponent({
	props: {
		value: {
			type: Array as PropType<(number | string | Record<string, any>)[] | null>,
			default: null,
		},
		primaryKey: {
			type: [Number, String],
			required: true,
		},
		collection: {
			type: String,
			required: true,
		},
		field: {
			type: String,
			required: true,
		},
		disabled: {
			type: Boolean,
			default: false,
		},
		placeholder: {
			type: String,
			default: null,
		},
		allowCustom: {
			type: Boolean,
			default: true,
		},
		referencingField: {
			type: String,
			default: '',
		},
		sortField: {
			type: String,
			default: undefined,
		},
		sortDirection: {
			type: String,
			default: 'desc',
		},
		iconLeft: {
			type: String,
			default: null,
		},
		iconRight: {
			type: String,
			default: 'local_offer',
		},
		filter: {
			type: Object as PropType<Filter>,
			default: null,
		},
	},
	emits: ['input'],
	setup(props, { emit }) {
		const { t } = useI18n();
		const { value, collection, field } = toRefs(props);
		const { relationInfo } = useRelationM2M(collection, field, useStores());
		const { usePermissionsStore } = useStores();
		const { hasPermission } = usePermissionsStore();

		const relationCollection = relationInfo.value.relatedCollection.collection;
		const relatedPrimaryKeyField = relationInfo.value.relatedPrimaryKeyField.field;
		const junctionCollection = relationInfo.value.junctionCollection.collection;
		const junctionField = relationInfo.value.junctionField.field;
		const junctionPrimaryKeyField = relationInfo.value.junctionPrimaryKeyField.field;

		const createAllowed = computed(() => {
			if (!relationInfo.value || !props.allowCustom) return false;
			return hasPermission(relationCollection, 'create');
		});

		const localInput = ref<string>('');
		const menuActive = ref<boolean>(false);
		const suggestedItems = ref<Record<string, any>[]>([]);
		const suggestedItemsSelected = ref<number | null>(null);
		const api = useApi();

		const referencingField = props.referencingField || relatedPrimaryKeyField;
		const fetchFields = [relatedPrimaryKeyField, referencingField];

		const items = updatePreviews(value);
		const sortedItems = computed(() => {
			if (!junctionField) return items.value;
			const sorted = clone(items.value).sort(
				(a: Record<string, Record<string, any>>, b: Record<string, Record<string, any>>) => {
					const aVal: string = a[junctionField][referencingField];
					const bVal: string = b[junctionField][referencingField];
					return props.sortDirection === 'desc'
						? bVal.localeCompare(aVal.toString())
						: aVal.localeCompare(bVal.toString());
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

		return {
			relationCollection,
			relatedPrimaryKeyField,
			junctionCollection,
			junctionField,
			junctionPrimaryKeyField,

			createAllowed,
			menuActive,
			showAddCustom,
			localInput,
			suggestedItems,
			suggestedItemsSelected,
			sortedItems,
			items,

			onInputKeyDown,
			addItemFromInput,
			addItemFromSuggestion,
			deleteItem,

			t,
		};

		function emitter(newVal: any[] | null) {
			emit('input', newVal);
		}

		function deleteItem(item: any) {
			if (value.value && !Array.isArray(value.value)) return;

			if (junctionPrimaryKeyField in item) {
				emitter(value.value.filter((x: any) => x !== item[junctionPrimaryKeyField]));
			} else {
				emitter(value.value.filter((x: any) => x !== item));
			}
		}

		function addItemFromSuggestion(item: any) {
			menuActive.value = false;
			emitter([...(props.value || []), { [junctionField]: item }]);
		}

		async function addItemFromInput() {
			const value = localInput.value?.trim();
			if (!value || itemValueStaged(value)) return;

			const cachedItem = suggestedItems.value.find((item) => item[referencingField] === value);
			if (cachedItem) {
				addItemFromSuggestion(cachedItem);
				return;
			}

			try {
				const item = await findByKeyword(value);
				if (item) {
					addItemFromSuggestion(item);
				} else if (createAllowed.value) {
					addItemFromSuggestion({ [referencingField]: value });
				}
			} catch (err: any) {
				window.console.warn(err);
			}
		}

		function itemValueStaged(value: string): boolean {
			if (!value) return false;
			return !!items.value.find((item) => item[junctionField][referencingField] === value);
		}

		function itemValueAvailable(value: string): boolean {
			if (!value) return false;
			return !!suggestedItems.value.find((item) => item[referencingField] === value);
		}

		async function refreshSuggestions(keyword: string) {
			suggestedItemsSelected.value = null;
			if (!keyword || keyword.length < 1) {
				suggestedItems.value = [];
				return;
			}
			const filter = parseFilter(props.filter, null) || {};
			const currentIds = items.value.map((i) => i[junctionField][relatedPrimaryKeyField]).filter((i) => !!i);
			const query = {
				params: {
					limit: 10,
					fields: fetchFields,
					filter: {
						[referencingField]: {
							_contains: keyword,
						},
						...(currentIds.length > 0 && {
							[relatedPrimaryKeyField]: {
								_nin: currentIds.join(','),
							},
						}),
						...filter,
					},
					sort: props.sortField
						? props.sortDirection === 'desc'
							? `-${props.sortField}`
							: props.sortField
						: `-${relatedPrimaryKeyField}`,
				},
			};
			const response = await api.get(getEndpoint(relationCollection), query);
			if (response?.data?.data && Array.isArray(response.data.data)) {
				suggestedItems.value = response.data.data;
			} else {
				suggestedItems.value = [];
			}
		}

		async function findByKeyword(keyword: string): Promise<Record<string, any> | null> {
			const response = await api.get(getEndpoint(relationCollection), {
				params: {
					limit: 1,
					fields: fetchFields,
					filter: {
						[referencingField]: {
							_eq: keyword,
						},
					},
				},
			});

			return response?.data?.data?.pop() || null;
		}

		function updatePreviews(value: Ref) {
			const items = ref<any[]>([]);
			const relationalFetchFields = [
				junctionPrimaryKeyField,
				...fetchFields.map((field) => junctionField + '.' + field),
			];

			watch(value, (newVal) => update(newVal));

			if (value.value && !Array.isArray(value.value)) return items;

			update(value.value);

			return items;

			async function update(value: any[]) {
				const ids = (value || []).filter((x: any) => typeof x !== 'object');
				const staged = (value || []).filter((x: any) => typeof x === 'object');

				if (!ids.length) {
					items.value = [...staged];
					return;
				}

				const response = await api.get(getEndpoint(junctionCollection), {
					params: {
						fields: relationalFetchFields,
						limit: -1,
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
					localInput.value = '';
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
	},
});
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
