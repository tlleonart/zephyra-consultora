// Public component surface of @zephyra/ui.
//
// This barrel is PRESENTATIONAL COMPONENTS ONLY. The two providers are
// deliberately NOT re-exported here and are reached through their own subpath
// exports (`@zephyra/ui/providers/ConvexProvider`,
// `@zephyra/ui/providers/ToastProvider`) — see README "Why the providers are
// not on the barrel". Short version: ConvexProvider constructs a
// ConvexReactClient at MODULE SCOPE from NEXT_PUBLIC_CONVEX_URL, and pulling
// that into the module graph of every file that imports a Button is how
// `next build` starts failing with "Client created with undefined deployment
// address" on pages that never touched Convex.
//
// The two stylesheets are also separate subpaths: CSS is imported for effect,
// never re-exported from TypeScript.

export { Button } from './components/ui/Button';
export type { ButtonProps, ButtonVariant, ButtonSize } from './components/ui/Button';

// The button visual contract, element-agnostic. This is the ONE exception to
// "CSS is imported for effect, never re-exported from TypeScript": btnClass
// returns hashed CSS-Module class NAMES as a string, so a <Link>, an <a> or a
// <button> in any app can wear the same button skin without that app importing a
// package stylesheet — and without anchors being rewritten as <button>, which is
// how you lose href, middle-click and the right role for assistive tech.
export { btnClass, btnSpinnerClass } from './styles/btn';
export type { BtnClassOptions, BtnVariant, BtnSize } from './styles/btn';

export { Card, CardHeader, CardContent, CardFooter } from './components/ui/Card';
export type {
  CardProps,
  CardHeaderProps,
  CardContentProps,
  CardFooterProps,
} from './components/ui/Card';

export { IconPicker } from './components/ui/IconPicker';

export { ImageUpload } from './components/ui/ImageUpload';
export type { ImageUploadProps } from './components/ui/ImageUpload';
export { resolveImagePreview } from './components/ui/ImageUpload';
export type { ImagePreviewState } from './components/ui/ImageUpload';

// Primitiva de menú desplegable. NO existía menú en este barril —había Button,
// Card, IconPicker, ImageUpload, Input, Modal/ConfirmDialog, Select, Skeleton,
// Table, Toast, ClientOnly, ErrorBoundary y btnClass, y ninguna es un menú— así
// que un menú de cuenta se iba a construir a mano en cada superficie que lo
// necesitara, con la accesibilidad reinventada cada vez.
//
// `resolveMenuKey` sale al barril junto con el componente, y no es un detalle
// interno filtrado: es la máquina de teclado pura, y exportarla es lo que
// permite verificar por unidad las reglas de foco de este menú en un runner sin
// DOM. El componente sin ella sólo se puede probar en un navegador.
export { DropdownMenu, resolveMenuKey, CLOSED_MENU } from './components/ui/DropdownMenu';
export type {
  DropdownMenuProps,
  DropdownMenuEntry,
  DropdownMenuItemRenderProps,
  MenuState,
  MenuKeyResult,
  MenuFocusTarget,
} from './components/ui/DropdownMenu';

export { Input } from './components/ui/Input';
export type { InputProps } from './components/ui/Input';

export { Modal, ConfirmDialog } from './components/ui/Modal';
export type { ModalProps, ConfirmDialogProps } from './components/ui/Modal';

export { Select } from './components/ui/Select';
export type { SelectProps, SelectOption } from './components/ui/Select';

export {
  Skeleton,
  SkeletonText,
  SkeletonCard,
  SkeletonAvatar,
  SkeletonTableRow,
} from './components/ui/Skeleton';
export type { SkeletonProps } from './components/ui/Skeleton';

export { Table } from './components/ui/Table';
export type { TableProps, Column } from './components/ui/Table';

export { Toast } from './components/ui/Toast';
export type { ToastProps, ToastVariant } from './components/ui/Toast';

// Carried over from apps/legacy per domain-boundaries §3. NOTHING in apps/legacy
// imports either of these today (zero call sites, verified) — they are dead code
// moved forward so the boundary doc holds, not working components. See README.
export { ClientOnly } from './components/ClientOnly';
export { ErrorBoundary } from './components/ErrorBoundary';
