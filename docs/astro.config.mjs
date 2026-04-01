// @ts-check
import starlight from '@astrojs/starlight'
import { defineConfig } from 'astro/config'
import starlightImageZoom from 'starlight-image-zoom'
import starlightSidebarTopics from 'starlight-sidebar-topics'
import starlightThemeRapide from 'starlight-theme-rapide'
import starlightTypeDoc from 'starlight-typedoc'

import { optimizeTypeDocTables } from './post_build.mjs'

export default defineConfig({
  site: 'https://ryanwtf7.github.io/',
  base: 'ryanlink',
  redirects: {
    '/ryanlink/api/lavamanager/classes/lavalinkmanager': '/ryanlink/api/core/Manager/classes/RyanlinkManager',
    '/ryanlink/api/ryanlinkmanager/classes/ryanlinkmanager': '/ryanlink/api/core/Manager/classes/RyanlinkManager',
    '/ryanlink/api/core/manager/classes/ryanlinkmanager': '/ryanlink/api/core/Manager/classes/RyanlinkManager',
    '/ryanlink/api/audio/player/classes/autoplay': '/ryanlink/api/audio/Player/classes/Autoplay',
    '/ryanlink/api/audio/player/classes/player': '/ryanlink/api/audio/Player/classes/Player',
    '/ryanlink/api/audio/filters/classes/filtermanager': '/ryanlink/api/audio/Filters/classes/FilterManager',
    '/ryanlink/api/audio/queue/classes/queue': '/ryanlink/api/audio/Queue/classes/Queue',
    '/ryanlink/api/audio/queue/classes/queuesaver': '/ryanlink/api/audio/Queue/classes/QueueSaver',
    '/ryanlink/api/audio/queuestore/classes/localdiskqueuestore': '/ryanlink/api/audio/QueueStore/classes/LocalDiskQueueStore',
    '/ryanlink/api/audio/queuestore/classes/memoryqueuestore': '/ryanlink/api/audio/QueueStore/classes/MemoryQueueStore',
    '/ryanlink/api/audio/queuestore/classes/redisqueuestore': '/ryanlink/api/audio/QueueStore/classes/RedisQueueStore',
    '/ryanlink/api/node/node/classes/node': '/ryanlink/api/node/Node/classes/Node',
    '/ryanlink/api/node/nodelink/classes/nodelink': '/ryanlink/api/node/NodeLink/classes/NodeLink',
    '/ryanlink/api/node/nodemanager/classes/nodemanager': '/ryanlink/api/node/NodeManager/classes/NodeManager',
    '/ryanlink/home/setup-lavalink': '/ryanlink/home/setup-ryanlink',
  },
  integrations: [
    starlight({
      title: 'ryanlink',
      description: 'High-performance Lavalink v4 wrapper for Discord bots.',
      logo: {
        src: './src/assets/ryanlink.png',
      },
      social: [
        { icon: 'discord', href: 'https://discord.gg/W2GheK3F9m', label: 'Discord' },
        { icon: 'seti:github', href: 'https://github.com/ryanwtf7/ryanlink', label: 'GitHub' },
        { icon: 'email', href: 'mailto:ryanwtf88@gmail.com', label: 'Email' },
      ],
      editLink: {
        baseUrl: 'https://github.com/ryanwtf7/ryanlink/tree/master',
      },
      lastUpdated: true,
      pagination: true,
      tableOfContents: { minHeadingLevel: 2, maxHeadingLevel: 4 },
      plugins: [
        starlightThemeRapide(),
        starlightImageZoom(),
        starlightSidebarTopics(
          [
            {
              id: 'docs',
              label: 'Docs',
              icon: 'open-book',
              link: '/home/installation',
              items: [
                {
                  label: 'Getting Started',
                  items: [
                    { label: 'Installation', link: '/home/installation' },
                    { label: 'Quick Setup', link: '/home/setup-ryanlink' },
                    { label: 'Lavalink Config', link: '/home/lavalink-hosting' },
                    { label: 'Configuration', link: '/home/configuration' },
                    { label: 'Features', link: '/home/features' },
                  ],
                },
                {
                  label: 'Guides',
                  items: [
                    { label: 'Architecture', link: '/home/architecture' },
                    { label: 'Session Resuming', link: '/extra/resuming' },
                    { label: 'Autoplay System', link: '/extra/autoplay-system' },
                    { label: 'Plugin Integrations', link: '/extra/plugins' },
                    { label: 'NodeLink Features', link: '/extra/nodelink' },
                    { label: 'Search Prefixes', link: '/extra/search-platforms' },
                  ],
                },
                {
                  label: 'Events',
                  items: [
                    { label: 'Manager Events', link: '/extra/manager-events' },
                    { label: 'Node Events', link: '/extra/node-events' },
                  ],
                },
              ],
            },
            {
              id: 'api',
              label: 'API',
              icon: 'seti:typescript',
              link: '/api/core/manager/classes/ryanlinkmanager',
              items: [
                {
                  label: 'Core',
                  items: [
                    { label: 'RyanlinkManager', autogenerate: { directory: 'api/core/Manager/classes' } },
                    { label: 'Player', autogenerate: { directory: 'api/audio/Player/classes' } },
                    { label: 'Filters', autogenerate: { directory: 'api/audio/Filters/classes' } },
                    { label: 'Queue', autogenerate: { directory: 'api/audio/Queue/classes' } },
                  ],
                },
                {
                  label: 'Nodes',
                  items: [
                    { label: 'Node (Lavalink)', autogenerate: { directory: 'api/node/Node/classes' } },
                    { label: 'NodeLink', autogenerate: { directory: 'api/node/NodeLink/classes' } },
                    { label: 'NodeManager', autogenerate: { directory: 'api/node/NodeManager/classes' } },
                  ],
                },
                {
                  label: 'Utilities',
                  items: [
                    { label: 'Track Registry', autogenerate: { directory: 'api/utils/TrackRegistry/classes' } },
                  ],
                },
                {
                  label: 'Types',
                  collapsed: true,
                  items: [
                    { label: 'Manager Types', autogenerate: { directory: 'api/types/Manager' } },
                    { label: 'Player Types', autogenerate: { directory: 'api/types/Player' } },
                    { label: 'Node Types', autogenerate: { directory: 'api/types/Node' } },
                    { label: 'NodeLink Types', autogenerate: { directory: 'api/types/NodeLink' } },
                    { label: 'Track Types', autogenerate: { directory: 'api/types/Track' } },
                    { label: 'Filter Types', autogenerate: { directory: 'api/types/Filters' } },
                    { label: 'Utility Types', autogenerate: { directory: 'api/types/Utils' } },
                  ],
                },
                {
                  label: 'Enums',
                  collapsed: true,
                  items: [
                    { label: 'Constants', autogenerate: { directory: 'api/config/Constants/enumerations' } },
                    { label: 'Node Enums', autogenerate: { directory: 'api/types/Node/enumerations' } },
                  ],
                },
              ],
            },
          ],
          {
            topics: {
              api: ['/api/**'],
              docs: ['/home/**', '/extra/**'],
            },
          },
        ),
        starlightTypeDoc({
          entryPoints: ['../src/**/*.ts'],
          tsconfig: '../tsconfig.json',
          typeDoc: {
            useCodeBlocks: true,
            parametersFormat: 'table',
            propertiesFormat: 'table',
            enumMembersFormat: 'table',
            typeDeclarationFormat: 'table',
            indexFormat: 'table',
            expandParameters: true,
            name: 'ryanlink',
          },
          pagination: true,
        }),
      ],
      customCss: ['./src/styles/global.css'],
    }),
    optimizeTypeDocTables(),
  ],
})
