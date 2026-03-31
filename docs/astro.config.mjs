import starlight from '@astrojs/starlight'
// @ts-check
import { defineConfig } from 'astro/config'
import starlightTypeDoc, { typeDocSidebarGroup } from 'starlight-typedoc'

import { optimizeTypeDocTables } from './post_build.mjs'

// https://astro.build/config
export default defineConfig({
  site: 'https://ryanwtf7.github.io/',
  base: 'ryanlink',
  redirects: {
    '/ryanlink/api/lavamanager/classes/lavalinkmanager': '/ryanlink/api/core/manager/classes/ryanlinkmanager',
    '/ryanlink/api/ryanlinkmanager/classes/ryanlinkmanager': '/ryanlink/api/core/manager/classes/ryanlinkmanager',
    '/ryanlink/home/setup-lavalink': '/ryanlink/home/setup-ryanlink',
  },
  integrations: [
    starlight({
      title: 'ryanlink',
      logo: {
        src: './src/assets/ryanlink.png',
      },
      social: [
        {
          icon: 'discord',
          href: 'https://discord.gg/W2GheK3F9m',
          label: 'Support-discord',
        },
        {
          icon: 'seti:github',
          href: 'https://github.com/ryanwtf7/ryanlink',
          label: 'Github Repository',
        },
        {
          icon: 'email',
          href: 'mailto:ryanwtf88@gmail.com',
          label: 'Send an Email',
        },
      ],
      editLink: {
        baseUrl: 'https://github.com/ryanwtf7/ryanlink/tree/master',
      },
      plugins: [
        // Generate the documentation.
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
      sidebar: [
        {
          label: 'Getting Started',
          items: [
            { label: 'Installation', link: '/home/installation' },
            { label: 'Quick Setup', link: '/home/setup-ryanlink' },
            { label: 'Hosting Guide', link: '/home/lavalink-hosting' },
            { label: 'Core Features', link: '/home/features' },
          ],
        },
        {
          label: 'Library Overview',
          items: [
            { label: 'Architecture Overview', link: '/home/architecture' },
            { label: 'Session Persistence', link: '/extra/resuming' },
            { label: 'Feature Guides', link: '/home/example' },
          ],
        },
        {
          label: 'API Reference',
          collapsed: false,
          items: [
            { label: 'RyanlinkManager', autogenerate: { directory: 'api/core/Manager/classes' } },
            { label: 'Player', autogenerate: { directory: 'api/audio/Player/classes' } },
            { label: 'Node', autogenerate: { directory: 'api/node/Node/classes' } },
            { label: 'NodeManager', autogenerate: { directory: 'api/node/NodeManager/classes' } },
            { label: 'Filters', autogenerate: { directory: 'api/audio/Filters/classes' } },
            { label: 'Queue', autogenerate: { directory: 'api/audio/Queue/classes' } },
            { label: 'Track Registry', autogenerate: { directory: 'api/utils/TrackRegistry/classes' } },
          ],
        },
        {
          label: 'Data Structures (Types)',
          collapsed: true,
          items: [
            { label: 'Manager Types', autogenerate: { directory: 'api/types/Manager' } },
            { label: 'Player Types', autogenerate: { directory: 'api/types/Player' } },
            { label: 'Node Types', autogenerate: { directory: 'api/types/Node' } },
            { label: 'Track Types', autogenerate: { directory: 'api/types/Track' } },
            { label: 'Filter Types', autogenerate: { directory: 'api/types/Filters' } },
            { label: 'Utility Types', autogenerate: { directory: 'api/types/Utils' } },
          ],
        },
        {
          label: 'Enums & Utilities',
          collapsed: true,
          items: [
            { label: 'Manager Events', link: '/extra/manager-events' },
            { label: 'Node Events', link: '/extra/node-events' },
            { label: 'Search Prefixes', link: '/extra/search-platforms' },
            {
              label: 'All Enums', items: [
                { label: 'Constants', autogenerate: { directory: 'api/config/Constants/enumerations' } },
                { label: 'Node Types', autogenerate: { directory: 'api/types/Node/enumerations' } },
              ]
            },
          ],
        },
        {
          label: 'Ecosystem',
          collapsed: true,
          items: [
            { label: 'Plugin Integrations', link: '/extra/plugins' },
            { label: 'Autoplay System', link: '/extra/autoplay-system' },
          ],
        },
        {
          label: 'GitHub',
          link: 'https://github.com/ryanwtf7/ryanlink',
        },
        {
          label: 'Discord',
          link: 'https://discord.gg/W2GheK3F9m',
        },
      ],
      customCss: ['./src/styles/global.css'],
    }),
    optimizeTypeDocTables(),
  ],
})
