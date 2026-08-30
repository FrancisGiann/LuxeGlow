export const SERVICE_CATEGORIES = ['Packages', 'Nails', 'Spa & Massage', 'Brows & Lashes', 'Waxing', 'Kids'];

export const SERVICE_METADATA_OPTIONS = [
  {
    itemType: 'service',
    label: 'Service',
    categories: [
      { value: 'Nails', subcategories: ['Nail care', 'Gel polish', 'Nail extensions', 'Removal'] },
      { value: 'Spa & Massage', subcategories: ['Massage', 'Spa treatments'] },
      { value: 'Brows & Lashes', subcategories: ['Brows & lashes'] },
      { value: 'Waxing', subcategories: ['Wax hair removal'] },
      { value: 'Kids', subcategories: ['Kiddie treats'] },
    ],
  },
  {
    itemType: 'add_on',
    label: 'Add-on',
    categories: [{ value: 'Nails', subcategories: ['Nail add-ons'] }],
  },
  {
    itemType: 'package',
    label: 'Package',
    categories: [{ value: 'Packages', subcategories: ['Fixed packages'] }],
  },
];

export function serviceTypeOptions() {
  return SERVICE_METADATA_OPTIONS.map(({ itemType, label }) => ({ value: itemType, label }));
}

export function serviceCategoryOptions(itemType) {
  const categories = SERVICE_METADATA_OPTIONS.find((option) => option.itemType === itemType)?.categories || [];
  return categories.map(({ value, subcategories }) => ({ value, subcategories: [...subcategories] }));
}

export function serviceSubcategoryOptions(itemType, category) {
  return serviceCategoryOptions(itemType).find((option) => option.value === category)?.subcategories || [];
}

export function isCanonicalServiceMetadata({ item_type: itemType, category, subcategory } = {}) {
  return serviceSubcategoryOptions(itemType, category).includes(subcategory);
}
