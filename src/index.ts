import { defineInterface } from '@directus/extensions-sdk';
import TagsM2MInterface from './interface.vue';

export default defineInterface({
	id: 'extension-tags-m2m',
	name: '$t:interfaces.tags.tags',
	description: '$t:interfaces.tags.description',
	icon: 'local_offer',
	component: TagsM2MInterface,
	relational: true,
	types: ['alias'],
	localTypes: ['m2m'],
	group: 'relational',
	recommendedDisplays: ['related-values'],
	options: ({ relations }) => {
		return [
			{
				field: 'placeholder',
				name: '$t:placeholder',
				type: 'string',
				meta: {
					width: 'full',
					interface: 'system-input-translated-string',
					options: {
						placeholder: '$t:enter_a_placeholder',
					},
				},
			},
			{
				field: 'iconLeft',
				name: '$t:icon_left',
				type: 'string',
				meta: {
					width: 'half',
					interface: 'select-icon',
				},
			},
			{
				field: 'iconRight',
				name: '$t:icon_right',
				type: 'string',
				meta: {
					width: 'half',
					interface: 'select-icon',
				},
				schema: {
					default_value: 'local_offer',
				},
			},
			{
				field: 'referencingField',
				name: '$t:corresponding_field',
				type: 'string',
				collection: relations.m2o?.related_collection,
				meta: {
					required: true,
					width: 'full',
					interface: 'system-field',
					options: {
						typeAllowList: ['string', 'integer', 'bigInteger'],
						allowPrimaryKey: true,
					},
				},
			},
			{
				field: 'allowCustom',
				name: '$t:interfaces.select-dropdown.allow_other',
				type: 'boolean',
				meta: {
					width: 'half',
					interface: 'boolean',
					options: {
						label: '$t:interfaces.select-dropdown.allow_other_label',
					},
				},
				schema: {
					default_value: true,
				},
			},
			{
				field: 'filter',
				name: '$t:filter',
				type: 'json',
				meta: {
					interface: 'system-filter',
					options: {
						collectionName: relations.m2o?.related_collection ?? null,
					},
					conditions: [
						{
							rule: {
								enableSelect: {
									_eq: false,
								},
							},
							hidden: true,
						},
					],
				},
			},
			{
				field: 'sortField',
				type: 'string',
				name: '$t:sort_field',
				collection: relations.m2o?.related_collection,
				meta: {
					width: 'half',
					interface: 'system-field',
					options: {
						allowPrimaryKey: true,
						allowNone: true,
					},
				},
			},
			{
				field: 'sortDirection',
				type: 'string',
				name: '$t:sort_direction',
				schema: {
					default_value: 'desc',
				},
				meta: {
					width: 'half',
					interface: 'select-dropdown',
					options: {
						choices: [
							{
								text: '$t:sort_asc',
								value: 'asc',
							},
							{
								text: '$t:sort_desc',
								value: 'desc',
							},
						],
					},
				},
			},
		];
	},
});
