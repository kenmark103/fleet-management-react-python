import { createFileRoute, redirect } from '@tanstack/react-router'

/**
 * index.tsx — handles the root path "/"
 *
 * FILE-BASED ROUTING LESSON:
 * A file named index.tsx inside routes/ maps to the "/" path.
 * We use beforeLoad to redirect immediately to /dashboard.
 * If the user isn't logged in, the _auth layout will catch them
 * and redirect to /login before dashboard ever loads.
 */
export const Route = createFileRoute('/')({
  beforeLoad: () => {
    throw redirect({ to: '/dashboard' })
  },
})
