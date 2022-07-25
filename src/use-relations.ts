/**
 * @file
 * Local version of use-relations-m2m because the original one is
 * not available through composables.
 *
 * Patched useRelationM2M() to support stores passing from the interface
 *
 * @see https://github.com/directus/directus/blob/main/app/src/composables/use-relation-m2m.ts
 */

import { computed, Ref } from 'vue';
import { Field, Relation, Collection } from '@directus/shared/types';

export type RelationM2M = {
	relation: Relation;
	relatedCollection: Collection;
	relatedPrimaryKeyField: Field;
	junctionCollection: Collection;
	junctionPrimaryKeyField: Field;
	junctionField: Field;
	reverseJunctionField: Field;
	junction: Relation;
	sortField?: string;
	type: 'm2m';
};

export function useRelationM2M(collection: Ref<string>, field: Ref<string>, patchedFnParamStores: Record<string, any>) {
	// Patch to support stores from parameter.
	const { useCollectionsStore, useRelationsStore, useFieldsStore } = patchedFnParamStores;

	const relationsStore = useRelationsStore();
	const collectionsStore = useCollectionsStore();
	const fieldsStore = useFieldsStore();

	const relationInfo = computed<RelationM2M | undefined>(() => {
		const relations = relationsStore.getRelationsForField(collection.value, field.value);

		const junction = relations.find(
			(relation) =>
				relation.related_collection === collection.value &&
				relation.meta?.one_field === field.value &&
				relation.meta.junction_field
		);

		if (!junction) return undefined;

		const relation = relations.find(
			(relation) => relation.collection === junction.collection && relation.field === junction.meta?.junction_field
		);

		if (!relation) return undefined;

		return {
			relation: relation,
			relatedCollection: collectionsStore.getCollection(relation.related_collection as string),
			relatedPrimaryKeyField: fieldsStore.getPrimaryKeyFieldForCollection(relation.related_collection as string),
			sortField: junction.meta?.sort_field ?? undefined,
			junctionCollection: collectionsStore.getCollection(junction.collection),
			junctionPrimaryKeyField: fieldsStore.getPrimaryKeyFieldForCollection(junction.collection),
			junctionField: fieldsStore.getField(junction.collection, junction.meta?.junction_field as string),
			reverseJunctionField: fieldsStore.getField(junction.collection, relation.meta?.junction_field as string),
			junction: junction,
			type: 'm2m',
		} as RelationM2M;
	});

	return { relationInfo };
}
