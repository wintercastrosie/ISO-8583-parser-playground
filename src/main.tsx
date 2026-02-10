import React from 'react'
import ReactDOM from 'react-dom/client'
import { MantineProvider, createTheme } from '@mantine/core'
import '@mantine/core/styles.css'
import App from './App'
import './index.css'

const theme = createTheme({
    primaryColor: 'dark',
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    headings: {
        fontFamily: 'DM Sans, Inter, sans-serif',
        fontWeight: '800',
    },
    colors: {
        brand: [
            '#F5F0EB', '#EDE5DC', '#D4C4B8', '#C19A8A',
            '#9B7B9E', '#5E6D7E', '#3D4A5C', '#2C3A4C',
            '#1A2634', '#0F1922',
        ],
    },
    radius: {
        xs: '4px',
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '24px',
    },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <MantineProvider theme={theme} defaultColorScheme="light">
            <App />
        </MantineProvider>
    </React.StrictMode>,
)
