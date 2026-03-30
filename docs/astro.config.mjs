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
          href: 'mailto:ryan@heavencloud.io',
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
          collapsed: true,
          items: [
            {
              label: 'installation',
              link: '/home/installation',
            },
            {
              label: 'Lavalink Setup',
              link: '/home/setup-ryanlink',
            },
            {
              label: 'Lavalink Hosting',
              link: '/home/lavalink-hosting',
            },
            {
              label: 'Features',
              link: '/home/features',
            },
            {
              label: 'Example Guides',
              link: '/home/example',
            },
            {
              label: 'Sample Configuration',
              link: '/home/configuration',
            },
            {
              label: 'Tipps and Tricks',
              link: '/home/tipps_and_tricks',
            },
            {
              label: 'Checkout Docs (Manager-Class)',
              link: '/api/core/manager/classes/ryanlinkmanager',
            },
          ],
        },
        {
          label: 'Extra',
          collapsed: true,
          items: [
            {
              label: 'Manager Events',
              link: '/extra/manager-events',
            },
            {
              label: 'Node Events',
              link: '/extra/node-events',
            },
            {
              label: 'Autoplay System',
              link: '/extra/autoplay-system',
            },
            {
              label: 'Search Prefixes',
              link: '/extra/search-platforms',
            },
            {
              label: 'Plugin Integrations',
              link: '/extra/plugins',
            },
            {
              label: 'Resuming',
              link: '/extra/resuming',
            },
          ],
        },
        typeDocSidebarGroup,
        {
          label: 'GitHub',
          link: 'https://github.com/ryanwtf7/ryanlink',
        },
        {
          label: 'NPM',
          link: 'https://npmjs.com/ryanlink',
        },
        {
          label: 'Ryanlink Discord',
          link: 'https://discord.gg/W2GheK3F9m',
        },
      ],
      customCss: ['./src/styles/global.css'],
    }),
    optimizeTypeDocTables(),
  ],
})
