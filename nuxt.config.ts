// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxt/fonts'],
  fonts: {
    defaults: {
      weights: [900]
    },
    families: [
      {
        name: 'trypewriter', // this becomes the CSS font-family
        src: [
          {
            url: '/fonts/KingthingsTrypewriter2.ttf'
          }
        ]
      }
    ]
  },
  css: [ '~/assets/main.css' ],
})