import type { CommonPluginFilters, JsonObject } from "../../types/common";
import type { Filters } from "../api";

/**
 * Yields a union type of filter names (plugins included)
 */
export type FilterNames<PluginFilters extends JsonObject = CommonPluginFilters> = keyof Filters | keyof PluginFilters;

/**
 * Yields the value of a filter by name
 */
export type FilterValue<
    Name extends FilterNames<PluginFilters>,
    PluginFilters extends JsonObject = CommonPluginFilters,
> = Name extends keyof Filters
    ? Required<Filters>[Name]
    : Name extends keyof PluginFilters
      ? Required<PluginFilters>[Name]
      : never;

/**
 * Alias for Filters
 */
export type FilterData = Filters;

/**
 * Union of filter keys
 */
export type FilterKey = keyof Filters;
