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
						allowNone: false,
						typeAllowList: ['string', 'integer', 'bigInteger'],
						allowForeignKeys: false,
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
				field: 'allowMultiple',
				name: '$t:allow_multiple',
				type: 'boolean',
				meta: {
					width: 'half',
					interface: 'boolean',
					options: {
						label: 'Separate by [Space] [,] and [;]',
					},
				},
				schema: {
					default_value: false,
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
	recommendedDisplays: ['related-values'],
	preview: `<svg width="156" height="96" fill="none" xmlns="http://www.w3.org/2000/svg">
		<rect x="18" y="23" width="120" height="26" rx="6" fill="var(--background-page)" class="glow"/>
		<rect x="19" y="24" width="118" height="24" rx="5" stroke="var(--primary)" stroke-width="2"/>
		<rect x="28" y="33" width="30" height="6" rx="2" fill="var(--primary)" fill-opacity=".25"/>
		<rect x="18" y="57" width="30" height="6" rx="2" fill="var(--primary)"/>
		<rect x="66" y="57" width="40" height="6" rx="2" fill="var(--primary)"/>
		<rect x="42" y="67" width="30" height="6" rx="2" fill="var(--primary)"/>
		<rect x="52" y="57" width="10" height="6" rx="2" fill="var(--primary)"/>
		<rect x="110" y="57" width="20" height="6" rx="2" fill="var(--primary)"/>
		<rect x="76" y="67" width="10" height="6" rx="2" fill="var(--primary)"/>
		<rect x="90" y="67" width="20" height="6" rx="2" fill="var(--primary)"/>
		<rect x="18" y="67" width="20" height="6" rx="2" fill="var(--primary)"/>
	</svg>`,
});
