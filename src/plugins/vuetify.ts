import { createVuetify } from 'vuetify'
import { aliases, mdi } from 'vuetify/iconsets/mdi'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'

// Styles
import 'vuetify/styles'
import '@mdi/font/css/materialdesignicons.css'

const vuetify = createVuetify({
  components,
  directives,
  icons: {
    defaultSet: 'mdi',
    aliases,
    sets: {
      mdi,
    },
  },
  theme: {
    defaultTheme: 'light',
    themes: {
      light: {
        colors: {
          primary: '#667eea',
          secondary: '#764ba2',
          accent: '#f093fb',
          error: '#e53e3e',
          warning: '#f5a623',
          info: '#00bcd4',
          success: '#4caf50',
          surface: '#ffffff',
          background: '#f7fafc',
          'primary-gradient': '#667eea',
          'secondary-gradient': '#764ba2',
          'accent-gradient': '#f5576c',
        },
      },
      dark: {
        colors: {
          primary: '#667eea',
          secondary: '#764ba2',
          accent: '#f093fb',
          error: '#ef5350',
          warning: '#ff9800',
          info: '#2196f3',
          success: '#4caf50',
        },
      },
    },
  },
  defaults: {
    VBtn: {
      color: 'primary',
      variant: 'elevated',
      rounded: 'lg',
    },
    VCard: {
      rounded: 'lg',
      elevation: 4,
    },
    VTextField: {
      variant: 'outlined',
      rounded: 'lg',
    },
    VTextarea: {
      variant: 'outlined',
      rounded: 'lg',
    },
  },
})

export default vuetify 