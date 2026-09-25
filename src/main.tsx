import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router/dom'
import { bootstrap } from '@/app/bootstrap'
import { createAppRouter } from '@/app/router'
import './index.css'

const container = document.getElementById('root')!

function renderFatal(error: unknown) {
  console.error('[teleo] bootstrap failed', error)
  const lang = navigator.language.toLowerCase().startsWith('pl') ? 'pl' : 'en'
  const message =
    lang === 'pl'
      ? 'Teleo nie może otworzyć lokalnej bazy danych. Przyczyną może być tryb prywatny lub zablokowane dane witryn.'
      : 'Teleo cannot open its local database. Private browsing or blocked site data can cause this.'
  const box = document.createElement('div')
  box.setAttribute('role', 'alert')
  box.style.cssText = 'max-width:28rem;margin:20vh auto;padding:1.5rem;font:1rem/1.5 Georgia,serif;text-align:center'
  box.textContent = message
  container.replaceChildren(box)
}

bootstrap()
  .then(() => {
    const router = createAppRouter()
    createRoot(container).render(
      <StrictMode>
        <RouterProvider router={router} />
      </StrictMode>,
    )
  })
  .catch(renderFatal)
