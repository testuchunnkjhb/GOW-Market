export const safeArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;

  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.results)) return value.results;

  if (Array.isArray(value?.data?.data)) return value.data.data;

  console.warn("Not array:", value);
  return [];
};
