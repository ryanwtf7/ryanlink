import type { ClientCustomSearchPlatformUtils, RyanlinkSearchPlatform, SearchPlatform, SourcesRegex } from '../types/Utils'

export class SourceRegistry {
  public mappings: Map<string, string> = new Map()
  public matchers: Map<string, RegExp> = new Map()
  public plugins: Map<string, string> = new Map()

  constructor() {
    this.initializeDefaults()
  }

  private initializeDefaults() {
  }

  public registerMapping(alias: string, target: string) {
    this.mappings.set(alias.toLowerCase(), target)
  }

  public registerMatcher(name: string, regex: RegExp) {
    this.matchers.set(name, regex)
  }

  public registerPlugin(name: string, identifier: string) {
    this.plugins.set(name, identifier)
  }

  public getMapping(alias: string): string | undefined {
    return this.mappings.get(alias.toLowerCase())
  }

  public getAllMappings(): Record<string, string> {
    return Object.fromEntries(this.mappings)
  }

  public getAllMatchers(): Record<string, RegExp> {
    return Object.fromEntries(this.matchers)
  }

  public getAllPlugins(): Record<string, string> {
    return Object.fromEntries(this.plugins)
  }
}

const defaultRegistry = new SourceRegistry()

/** @deprecated Use SourceRegistry instead for dynamic mappings */
export const SourceMappings = defaultRegistry.getAllMappings() as Record<SearchPlatform, RyanlinkSearchPlatform | ClientCustomSearchPlatformUtils>

/** @deprecated Use SourceRegistry instead for dynamic plugins */
export const BuiltinSources = defaultRegistry.getAllPlugins() as Record<string, string>

/** @deprecated Use SourceRegistry instead for dynamic matchers */
export const LinkMatchers = defaultRegistry.getAllMatchers() as Record<SourcesRegex, RegExp>
