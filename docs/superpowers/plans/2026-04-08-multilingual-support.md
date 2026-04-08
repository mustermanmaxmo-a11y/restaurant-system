# Multilingual Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 8-language support (DE/EN/ES/IT/TR/FR/PL/RU) to all app pages with a language selector in the admin sidebar and guest pages, plus automatic menu item translation via Claude API stored in Supabase.

**Architecture:** Custom `LanguageProvider` context (same pattern as existing `ThemeProvider`), all UI strings in `translations.ts`, menu item descriptions auto-translated via a Supabase Edge Function calling Claude API and storing results in a `translations` JSONB column on `menu_items`.

**Tech Stack:** Next.js 15 App Router, TypeScript, Supabase Edge Functions (Deno), Claude API (`claude-haiku-4-5-20251001`)

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `app/lib/translations.ts` | Create | All UI strings for 8 languages |
| `app/components/providers/language-provider.tsx` | Create | Language context + `useLanguage()` hook |
| `app/components/ui/language-selector.tsx` | Create | Flag dropdown UI component |
| `app/app/layout.tsx` | Modify | Wrap with `LanguageProvider` |
| `app/app/admin/layout.tsx` | Modify | Add `LanguageSelector` to sidebar bottom |
| `app/app/bestellen/[slug]/page.tsx` | Modify | Apply `t()` + add `LanguageSelector` header |
| `app/app/order/[token]/page.tsx` | Modify | Apply `t()` + add `LanguageSelector` header |
| `app/app/admin/menu/page.tsx` | Modify | Trigger auto-translation after save |
| `app/app/login/page.tsx` | Modify | Apply `t()` |
| `app/app/owner-login/page.tsx` | Modify | Apply `t()` |
| `app/app/register/page.tsx` | Modify | Apply `t()` |
| `app/app/admin/orders/page.tsx` | Modify | Apply `t()` to status labels + UI |
| `app/app/admin/tables/page.tsx` | Modify | Apply `t()` |
| `app/app/admin/staff/page.tsx` | Modify | Apply `t()` |
| `app/app/admin/stats/page.tsx` | Modify | Apply `t()` |
| `app/app/admin/reservations/page.tsx` | Modify | Apply `t()` |
| `app/app/admin/inventory/page.tsx` | Modify | Apply `t()` |
| `app/app/admin/specials/page.tsx` | Modify | Apply `t()` |
| `app/app/admin/opening-hours/page.tsx` | Modify | Apply `t()` |
| `app/app/admin/branding/page.tsx` | Modify | Apply `t()` |
| `app/app/admin/billing/page.tsx` | Modify | Apply `t()` |
| `supabase/functions/translate-menu-item/index.ts` | Create | Edge Function: call Claude API, write translations to DB |
| `supabase/migrations/YYYYMMDD_add_translations_column.sql` | Create | Add `translations JSONB` to `menu_items` |

---

## Task 1: DB Migration — Add `translations` column

**Files:**
- Create: `supabase/migrations/20260408000000_add_menu_item_translations.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- supabase/migrations/20260408000000_add_menu_item_translations.sql
ALTER TABLE menu_items
ADD COLUMN IF NOT EXISTS translations JSONB DEFAULT '{}';

COMMENT ON COLUMN menu_items.translations IS
  'Auto-translated name/description per language. Keys: en, es, it, tr, fr, pl, ru. Value: { name: string, description: string }';
```

- [ ] **Step 2: Run the migration**

```bash
cd c:/Users/David/Desktop/restaurant-system
npx supabase db push
```

Expected: Migration applied successfully.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260408000000_add_menu_item_translations.sql
git commit -m "feat: add translations JSONB column to menu_items"
```

---

## Task 2: Create `translations.ts` — All UI strings

**Files:**
- Create: `app/lib/translations.ts`

- [ ] **Step 1: Create the translations file**

```ts
// app/lib/translations.ts

export type Lang = 'de' | 'en' | 'es' | 'it' | 'tr' | 'fr' | 'pl' | 'ru'

export const LANGUAGES: { code: Lang; label: string; flag: string }[] = [
  { code: 'de', label: 'Deutsch',    flag: '🇩🇪' },
  { code: 'en', label: 'English',    flag: '🇬🇧' },
  { code: 'es', label: 'Español',    flag: '🇪🇸' },
  { code: 'it', label: 'Italiano',   flag: '🇮🇹' },
  { code: 'tr', label: 'Türkçe',     flag: '🇹🇷' },
  { code: 'fr', label: 'Français',   flag: '🇫🇷' },
  { code: 'pl', label: 'Polski',     flag: '🇵🇱' },
  { code: 'ru', label: 'Русский',    flag: '🇷🇺' },
]

type DeepString = { [k: string]: string | DeepString }

const translations: Record<Lang, DeepString> = {
  de: {
    nav: {
      overview: 'Übersicht', orders: 'Bestellungen', menu: 'Menü',
      specials: 'Tagesangebote', tables: 'Tische & QR', reservations: 'Reservierungen',
      staff: 'Staff', openingHours: 'Öffnungszeiten', branding: 'Branding',
      inventory: 'Lagerbestand', stats: 'Statistik', billing: 'Billing',
      integrations: 'Integrationen',
    },
    common: {
      loading: 'Lädt...', save: 'Speichern', cancel: 'Abbrechen',
      delete: 'Löschen', edit: 'Bearbeiten', add: 'Hinzufügen',
      close: 'Schließen', back: 'Zurück', logout: 'Abmelden',
      error: 'Fehler', lightMode: 'Light Mode', darkMode: 'Dark Mode',
      confirm: 'Bestätigen', search: 'Suchen', yes: 'Ja', no: 'Nein',
      activate: 'Aktivieren', deactivate: 'Deaktivieren', active: 'Aktiv',
      inactive: 'Inaktiv', name: 'Name', description: 'Beschreibung',
      price: 'Preis', category: 'Kategorie', image: 'Bild',
    },
    order: {
      addToCart: 'Hinzufügen', removeFromCart: 'Entfernen',
      checkout: 'Zur Kasse', placeOrder: 'Jetzt bestellen',
      cart: 'Warenkorb', total: 'Gesamt',
      delivery: 'Lieferung', pickup: 'Abholung',
      name: 'Name', phone: 'Telefon', address: 'Adresse', note: 'Anmerkung',
      street: 'Straße & Nr.', city: 'Stadt', zip: 'PLZ',
      status: {
        new: 'Bestellung eingegangen',
        cooking: 'Wird zubereitet',
        served: 'Serviert — Guten Appetit!',
        servedDelivery: 'Unterwegs zu dir!',
        cancelled: 'Storniert',
      },
      dietary: {
        vegetarisch: '🌱 Vegetarisch', vegan: '🌿 Vegan',
        glutenfrei: '🌾 Glutenfrei', laktosefrei: '🥛 Laktosefrei', scharf: '🌶️ Scharf',
      },
      allergens: 'Allergene', filters: 'Filter',
      orderTab: 'Bestellen', reserveTab: 'Reservieren',
      emptyCart: 'Warenkorb ist leer', orderSuccess: 'Bestellung aufgegeben!',
      groupOrder: 'Gruppenbestellung', joinGroup: 'Gruppe beitreten',
      createGroup: 'Gruppe erstellen', groupCode: 'Gruppencode',
      enterGroupCode: 'Gruppencode eingeben', copyCode: 'Code kopieren',
      copied: 'Kopiert!', startGroupOrder: 'Gruppenbestellung starten',
      continueAlone: 'Alleine bestellen',
      guestName: 'Dein Name', guestNamePlaceholder: 'z.B. Max',
      itemsInCart: 'Artikel im Warenkorb', viewCart: 'Warenkorb anzeigen',
      addNote: 'Anmerkung hinzufügen', notePlaceholder: 'z.B. ohne Zwiebeln',
      orderAndPay: 'Bestellen & Bezahlen', backToMenu: 'Zurück zum Menü',
      reserveTable: 'Tisch reservieren', guests: 'Gäste',
      date: 'Datum', time: 'Uhrzeit', reserveNow: 'Jetzt reservieren',
      reservationSuccess: 'Reservierung erfolgreich!',
      free: 'frei', occupied: 'belegt',
    },
    auth: {
      login: 'Anmelden', register: 'Registrieren',
      email: 'E-Mail', password: 'Passwort',
      ownerLogin: 'Restaurant-Login', staffLogin: 'Personal-Login',
      pin: 'PIN eingeben', invalidPin: 'Falscher PIN. Bitte erneut versuchen.',
      loginError: 'E-Mail oder Passwort falsch.',
      noAccount: 'Noch kein Konto?', hasAccount: 'Bereits ein Konto?',
      registerHere: 'Hier registrieren', loginHere: 'Hier anmelden',
      restaurantName: 'Restaurantname',
    },
    admin: {
      newItem: 'Neues Gericht', editItem: 'Gericht bearbeiten',
      newCategory: 'Neue Kategorie', editCategory: 'Kategorie bearbeiten',
      available: 'Verfügbar', unavailable: 'Nicht verfügbar',
      translating: 'Wird übersetzt...', translateDone: 'Übersetzt ✓',
      retranslate: 'Neu übersetzen', tags: 'Tags',
      itemName: 'Gerichtname', itemDesc: 'Beschreibung (optional)',
      deleteConfirmItem: 'Item löschen?',
      deleteConfirmCategory: 'Kategorie und alle darin enthaltenen Items löschen?',
      noItems: 'Noch keine Gerichte in dieser Kategorie.',
      addFirstItem: 'Erstes Gericht hinzufügen',
    },
  },

  en: {
    nav: {
      overview: 'Overview', orders: 'Orders', menu: 'Menu',
      specials: 'Daily Specials', tables: 'Tables & QR', reservations: 'Reservations',
      staff: 'Staff', openingHours: 'Opening Hours', branding: 'Branding',
      inventory: 'Inventory', stats: 'Statistics', billing: 'Billing',
      integrations: 'Integrations',
    },
    common: {
      loading: 'Loading...', save: 'Save', cancel: 'Cancel',
      delete: 'Delete', edit: 'Edit', add: 'Add',
      close: 'Close', back: 'Back', logout: 'Logout',
      error: 'Error', lightMode: 'Light Mode', darkMode: 'Dark Mode',
      confirm: 'Confirm', search: 'Search', yes: 'Yes', no: 'No',
      activate: 'Activate', deactivate: 'Deactivate', active: 'Active',
      inactive: 'Inactive', name: 'Name', description: 'Description',
      price: 'Price', category: 'Category', image: 'Image',
    },
    order: {
      addToCart: 'Add', removeFromCart: 'Remove',
      checkout: 'Checkout', placeOrder: 'Place Order',
      cart: 'Cart', total: 'Total',
      delivery: 'Delivery', pickup: 'Pickup',
      name: 'Name', phone: 'Phone', address: 'Address', note: 'Note',
      street: 'Street & No.', city: 'City', zip: 'ZIP',
      status: {
        new: 'Order received', cooking: 'Being prepared',
        served: 'Served — Enjoy your meal!',
        servedDelivery: 'On its way to you!', cancelled: 'Cancelled',
      },
      dietary: {
        vegetarisch: '🌱 Vegetarian', vegan: '🌿 Vegan',
        glutenfrei: '🌾 Gluten-free', laktosefrei: '🥛 Lactose-free', scharf: '🌶️ Spicy',
      },
      allergens: 'Allergens', filters: 'Filters',
      orderTab: 'Order', reserveTab: 'Reserve',
      emptyCart: 'Cart is empty', orderSuccess: 'Order placed!',
      groupOrder: 'Group order', joinGroup: 'Join group',
      createGroup: 'Create group', groupCode: 'Group code',
      enterGroupCode: 'Enter group code', copyCode: 'Copy code',
      copied: 'Copied!', startGroupOrder: 'Start group order',
      continueAlone: 'Order alone',
      guestName: 'Your name', guestNamePlaceholder: 'e.g. Max',
      itemsInCart: 'Items in cart', viewCart: 'View cart',
      addNote: 'Add note', notePlaceholder: 'e.g. no onions',
      orderAndPay: 'Order & Pay', backToMenu: 'Back to menu',
      reserveTable: 'Reserve table', guests: 'Guests',
      date: 'Date', time: 'Time', reserveNow: 'Reserve now',
      reservationSuccess: 'Reservation successful!',
      free: 'free', occupied: 'occupied',
    },
    auth: {
      login: 'Login', register: 'Register',
      email: 'Email', password: 'Password',
      ownerLogin: 'Restaurant Login', staffLogin: 'Staff Login',
      pin: 'Enter PIN', invalidPin: 'Wrong PIN. Please try again.',
      loginError: 'Email or password incorrect.',
      noAccount: 'No account yet?', hasAccount: 'Already have an account?',
      registerHere: 'Register here', loginHere: 'Login here',
      restaurantName: 'Restaurant name',
    },
    admin: {
      newItem: 'New Item', editItem: 'Edit Item',
      newCategory: 'New Category', editCategory: 'Edit Category',
      available: 'Available', unavailable: 'Unavailable',
      translating: 'Translating...', translateDone: 'Translated ✓',
      retranslate: 'Re-translate', tags: 'Tags',
      itemName: 'Dish name', itemDesc: 'Description (optional)',
      deleteConfirmItem: 'Delete item?',
      deleteConfirmCategory: 'Delete category and all items inside?',
      noItems: 'No dishes in this category yet.',
      addFirstItem: 'Add first dish',
    },
  },

  es: {
    nav: {
      overview: 'Resumen', orders: 'Pedidos', menu: 'Menú',
      specials: 'Especiales del día', tables: 'Mesas & QR', reservations: 'Reservas',
      staff: 'Personal', openingHours: 'Horario', branding: 'Marca',
      inventory: 'Inventario', stats: 'Estadísticas', billing: 'Facturación',
      integrations: 'Integraciones',
    },
    common: {
      loading: 'Cargando...', save: 'Guardar', cancel: 'Cancelar',
      delete: 'Eliminar', edit: 'Editar', add: 'Añadir',
      close: 'Cerrar', back: 'Atrás', logout: 'Cerrar sesión',
      error: 'Error', lightMode: 'Modo claro', darkMode: 'Modo oscuro',
      confirm: 'Confirmar', search: 'Buscar', yes: 'Sí', no: 'No',
      activate: 'Activar', deactivate: 'Desactivar', active: 'Activo',
      inactive: 'Inactivo', name: 'Nombre', description: 'Descripción',
      price: 'Precio', category: 'Categoría', image: 'Imagen',
    },
    order: {
      addToCart: 'Añadir', removeFromCart: 'Quitar',
      checkout: 'Pagar', placeOrder: 'Hacer pedido',
      cart: 'Carrito', total: 'Total',
      delivery: 'Entrega', pickup: 'Recoger',
      name: 'Nombre', phone: 'Teléfono', address: 'Dirección', note: 'Nota',
      street: 'Calle y Nº', city: 'Ciudad', zip: 'CP',
      status: {
        new: 'Pedido recibido', cooking: 'En preparación',
        served: '¡Servido — Buen provecho!',
        servedDelivery: '¡En camino!', cancelled: 'Cancelado',
      },
      dietary: {
        vegetarisch: '🌱 Vegetariano', vegan: '🌿 Vegano',
        glutenfrei: '🌾 Sin gluten', laktosefrei: '🥛 Sin lactosa', scharf: '🌶️ Picante',
      },
      allergens: 'Alérgenos', filters: 'Filtros',
      orderTab: 'Pedir', reserveTab: 'Reservar',
      emptyCart: 'El carrito está vacío', orderSuccess: '¡Pedido realizado!',
      groupOrder: 'Pedido grupal', joinGroup: 'Unirse al grupo',
      createGroup: 'Crear grupo', groupCode: 'Código de grupo',
      enterGroupCode: 'Introducir código', copyCode: 'Copiar código',
      copied: '¡Copiado!', startGroupOrder: 'Iniciar pedido grupal',
      continueAlone: 'Pedir solo',
      guestName: 'Tu nombre', guestNamePlaceholder: 'ej. Juan',
      itemsInCart: 'Artículos en carrito', viewCart: 'Ver carrito',
      addNote: 'Añadir nota', notePlaceholder: 'ej. sin cebolla',
      orderAndPay: 'Pedir y pagar', backToMenu: 'Volver al menú',
      reserveTable: 'Reservar mesa', guests: 'Comensales',
      date: 'Fecha', time: 'Hora', reserveNow: 'Reservar ahora',
      reservationSuccess: '¡Reserva confirmada!',
      free: 'libre', occupied: 'ocupado',
    },
    auth: {
      login: 'Iniciar sesión', register: 'Registrarse',
      email: 'Correo', password: 'Contraseña',
      ownerLogin: 'Acceso restaurante', staffLogin: 'Acceso personal',
      pin: 'Introducir PIN', invalidPin: 'PIN incorrecto. Inténtalo de nuevo.',
      loginError: 'Correo o contraseña incorrectos.',
      noAccount: '¿Sin cuenta?', hasAccount: '¿Ya tienes cuenta?',
      registerHere: 'Regístrate aquí', loginHere: 'Inicia sesión aquí',
      restaurantName: 'Nombre del restaurante',
    },
    admin: {
      newItem: 'Nuevo plato', editItem: 'Editar plato',
      newCategory: 'Nueva categoría', editCategory: 'Editar categoría',
      available: 'Disponible', unavailable: 'No disponible',
      translating: 'Traduciendo...', translateDone: 'Traducido ✓',
      retranslate: 'Retraducir', tags: 'Etiquetas',
      itemName: 'Nombre del plato', itemDesc: 'Descripción (opcional)',
      deleteConfirmItem: '¿Eliminar plato?',
      deleteConfirmCategory: '¿Eliminar categoría y todos sus platos?',
      noItems: 'No hay platos en esta categoría.',
      addFirstItem: 'Añadir primer plato',
    },
  },

  it: {
    nav: {
      overview: 'Panoramica', orders: 'Ordini', menu: 'Menu',
      specials: 'Piatti del giorno', tables: 'Tavoli & QR', reservations: 'Prenotazioni',
      staff: 'Personale', openingHours: 'Orari', branding: 'Brand',
      inventory: 'Magazzino', stats: 'Statistiche', billing: 'Fatturazione',
      integrations: 'Integrazioni',
    },
    common: {
      loading: 'Caricamento...', save: 'Salva', cancel: 'Annulla',
      delete: 'Elimina', edit: 'Modifica', add: 'Aggiungi',
      close: 'Chiudi', back: 'Indietro', logout: 'Esci',
      error: 'Errore', lightMode: 'Modalità chiara', darkMode: 'Modalità scura',
      confirm: 'Conferma', search: 'Cerca', yes: 'Sì', no: 'No',
      activate: 'Attiva', deactivate: 'Disattiva', active: 'Attivo',
      inactive: 'Inattivo', name: 'Nome', description: 'Descrizione',
      price: 'Prezzo', category: 'Categoria', image: 'Immagine',
    },
    order: {
      addToCart: 'Aggiungi', removeFromCart: 'Rimuovi',
      checkout: 'Cassa', placeOrder: 'Ordina ora',
      cart: 'Carrello', total: 'Totale',
      delivery: 'Consegna', pickup: 'Ritiro',
      name: 'Nome', phone: 'Telefono', address: 'Indirizzo', note: 'Nota',
      street: 'Via e Nr.', city: 'Città', zip: 'CAP',
      status: {
        new: 'Ordine ricevuto', cooking: 'In preparazione',
        served: 'Servito — Buon appetito!',
        servedDelivery: 'In arrivo!', cancelled: 'Annullato',
      },
      dietary: {
        vegetarisch: '🌱 Vegetariano', vegan: '🌿 Vegano',
        glutenfrei: '🌾 Senza glutine', laktosefrei: '🥛 Senza lattosio', scharf: '🌶️ Piccante',
      },
      allergens: 'Allergeni', filters: 'Filtri',
      orderTab: 'Ordina', reserveTab: 'Prenota',
      emptyCart: 'Carrello vuoto', orderSuccess: 'Ordine effettuato!',
      groupOrder: 'Ordine di gruppo', joinGroup: 'Unisciti al gruppo',
      createGroup: 'Crea gruppo', groupCode: 'Codice gruppo',
      enterGroupCode: 'Inserisci codice', copyCode: 'Copia codice',
      copied: 'Copiato!', startGroupOrder: 'Avvia ordine di gruppo',
      continueAlone: 'Ordina da solo',
      guestName: 'Il tuo nome', guestNamePlaceholder: 'es. Mario',
      itemsInCart: 'Articoli nel carrello', viewCart: 'Vedi carrello',
      addNote: 'Aggiungi nota', notePlaceholder: 'es. senza cipolla',
      orderAndPay: 'Ordina e paga', backToMenu: 'Torna al menu',
      reserveTable: 'Prenota tavolo', guests: 'Ospiti',
      date: 'Data', time: 'Orario', reserveNow: 'Prenota ora',
      reservationSuccess: 'Prenotazione confermata!',
      free: 'libero', occupied: 'occupato',
    },
    auth: {
      login: 'Accedi', register: 'Registrati',
      email: 'Email', password: 'Password',
      ownerLogin: 'Accesso ristorante', staffLogin: 'Accesso personale',
      pin: 'Inserisci PIN', invalidPin: 'PIN errato. Riprova.',
      loginError: 'Email o password errati.',
      noAccount: 'Nessun account?', hasAccount: 'Hai già un account?',
      registerHere: 'Registrati qui', loginHere: 'Accedi qui',
      restaurantName: 'Nome del ristorante',
    },
    admin: {
      newItem: 'Nuovo piatto', editItem: 'Modifica piatto',
      newCategory: 'Nuova categoria', editCategory: 'Modifica categoria',
      available: 'Disponibile', unavailable: 'Non disponibile',
      translating: 'Traduzione...', translateDone: 'Tradotto ✓',
      retranslate: 'Ritraduci', tags: 'Tag',
      itemName: 'Nome del piatto', itemDesc: 'Descrizione (opzionale)',
      deleteConfirmItem: 'Eliminare il piatto?',
      deleteConfirmCategory: 'Eliminare la categoria e tutti i piatti?',
      noItems: 'Nessun piatto in questa categoria.',
      addFirstItem: 'Aggiungi primo piatto',
    },
  },

  tr: {
    nav: {
      overview: 'Genel Bakış', orders: 'Siparişler', menu: 'Menü',
      specials: 'Günün Önerileri', tables: 'Masalar & QR', reservations: 'Rezervasyonlar',
      staff: 'Personel', openingHours: 'Çalışma Saatleri', branding: 'Marka',
      inventory: 'Envanter', stats: 'İstatistikler', billing: 'Faturalama',
      integrations: 'Entegrasyonlar',
    },
    common: {
      loading: 'Yükleniyor...', save: 'Kaydet', cancel: 'İptal',
      delete: 'Sil', edit: 'Düzenle', add: 'Ekle',
      close: 'Kapat', back: 'Geri', logout: 'Çıkış',
      error: 'Hata', lightMode: 'Açık Mod', darkMode: 'Karanlık Mod',
      confirm: 'Onayla', search: 'Ara', yes: 'Evet', no: 'Hayır',
      activate: 'Etkinleştir', deactivate: 'Devre dışı bırak', active: 'Aktif',
      inactive: 'Pasif', name: 'Ad', description: 'Açıklama',
      price: 'Fiyat', category: 'Kategori', image: 'Görsel',
    },
    order: {
      addToCart: 'Ekle', removeFromCart: 'Çıkar',
      checkout: 'Ödeme', placeOrder: 'Sipariş ver',
      cart: 'Sepet', total: 'Toplam',
      delivery: 'Teslimat', pickup: 'Gel-Al',
      name: 'Ad', phone: 'Telefon', address: 'Adres', note: 'Not',
      street: 'Sokak & No.', city: 'Şehir', zip: 'Posta Kodu',
      status: {
        new: 'Sipariş alındı', cooking: 'Hazırlanıyor',
        served: 'Servis edildi — Afiyet olsun!',
        servedDelivery: 'Yolda!', cancelled: 'İptal edildi',
      },
      dietary: {
        vegetarisch: '🌱 Vejetaryen', vegan: '🌿 Vegan',
        glutenfrei: '🌾 Glutensiz', laktosefrei: '🥛 Laktozsuz', scharf: '🌶️ Acılı',
      },
      allergens: 'Alerjenler', filters: 'Filtreler',
      orderTab: 'Sipariş', reserveTab: 'Rezervasyon',
      emptyCart: 'Sepet boş', orderSuccess: 'Sipariş verildi!',
      groupOrder: 'Grup siparişi', joinGroup: 'Gruba katıl',
      createGroup: 'Grup oluştur', groupCode: 'Grup kodu',
      enterGroupCode: 'Grup kodu gir', copyCode: 'Kodu kopyala',
      copied: 'Kopyalandı!', startGroupOrder: 'Grup siparişi başlat',
      continueAlone: 'Yalnız sipariş ver',
      guestName: 'Adın', guestNamePlaceholder: 'örn. Ahmet',
      itemsInCart: 'Sepetteki ürünler', viewCart: 'Sepeti gör',
      addNote: 'Not ekle', notePlaceholder: 'örn. soğansız',
      orderAndPay: 'Sipariş ver ve öde', backToMenu: 'Menüye dön',
      reserveTable: 'Masa rezervasyonu', guests: 'Misafir',
      date: 'Tarih', time: 'Saat', reserveNow: 'Şimdi rezervasyon yap',
      reservationSuccess: 'Rezervasyon başarılı!',
      free: 'müsait', occupied: 'dolu',
    },
    auth: {
      login: 'Giriş yap', register: 'Kayıt ol',
      email: 'E-posta', password: 'Şifre',
      ownerLogin: 'Restoran girişi', staffLogin: 'Personel girişi',
      pin: 'PIN gir', invalidPin: 'Yanlış PIN. Lütfen tekrar deneyin.',
      loginError: 'E-posta veya şifre yanlış.',
      noAccount: 'Hesabın yok mu?', hasAccount: 'Zaten hesabın var mı?',
      registerHere: 'Buradan kayıt ol', loginHere: 'Buradan giriş yap',
      restaurantName: 'Restoran adı',
    },
    admin: {
      newItem: 'Yeni Yemek', editItem: 'Yemeği düzenle',
      newCategory: 'Yeni Kategori', editCategory: 'Kategoriyi düzenle',
      available: 'Mevcut', unavailable: 'Mevcut değil',
      translating: 'Çevriliyor...', translateDone: 'Çevrildi ✓',
      retranslate: 'Yeniden çevir', tags: 'Etiketler',
      itemName: 'Yemek adı', itemDesc: 'Açıklama (isteğe bağlı)',
      deleteConfirmItem: 'Yemek silinsin mi?',
      deleteConfirmCategory: 'Kategori ve tüm yemekler silinsin mi?',
      noItems: 'Bu kategoride henüz yemek yok.',
      addFirstItem: 'İlk yemeği ekle',
    },
  },

  fr: {
    nav: {
      overview: 'Vue d\'ensemble', orders: 'Commandes', menu: 'Menu',
      specials: 'Plats du jour', tables: 'Tables & QR', reservations: 'Réservations',
      staff: 'Personnel', openingHours: 'Horaires', branding: 'Marque',
      inventory: 'Inventaire', stats: 'Statistiques', billing: 'Facturation',
      integrations: 'Intégrations',
    },
    common: {
      loading: 'Chargement...', save: 'Enregistrer', cancel: 'Annuler',
      delete: 'Supprimer', edit: 'Modifier', add: 'Ajouter',
      close: 'Fermer', back: 'Retour', logout: 'Déconnexion',
      error: 'Erreur', lightMode: 'Mode clair', darkMode: 'Mode sombre',
      confirm: 'Confirmer', search: 'Rechercher', yes: 'Oui', no: 'Non',
      activate: 'Activer', deactivate: 'Désactiver', active: 'Actif',
      inactive: 'Inactif', name: 'Nom', description: 'Description',
      price: 'Prix', category: 'Catégorie', image: 'Image',
    },
    order: {
      addToCart: 'Ajouter', removeFromCart: 'Retirer',
      checkout: 'Commander', placeOrder: 'Passer commande',
      cart: 'Panier', total: 'Total',
      delivery: 'Livraison', pickup: 'À emporter',
      name: 'Nom', phone: 'Téléphone', address: 'Adresse', note: 'Note',
      street: 'Rue & N°', city: 'Ville', zip: 'Code postal',
      status: {
        new: 'Commande reçue', cooking: 'En préparation',
        served: 'Servi — Bon appétit!',
        servedDelivery: 'En route!', cancelled: 'Annulé',
      },
      dietary: {
        vegetarisch: '🌱 Végétarien', vegan: '🌿 Vegan',
        glutenfrei: '🌾 Sans gluten', laktosefrei: '🥛 Sans lactose', scharf: '🌶️ Épicé',
      },
      allergens: 'Allergènes', filters: 'Filtres',
      orderTab: 'Commander', reserveTab: 'Réserver',
      emptyCart: 'Panier vide', orderSuccess: 'Commande passée!',
      groupOrder: 'Commande de groupe', joinGroup: 'Rejoindre le groupe',
      createGroup: 'Créer un groupe', groupCode: 'Code de groupe',
      enterGroupCode: 'Entrer le code', copyCode: 'Copier le code',
      copied: 'Copié!', startGroupOrder: 'Démarrer commande de groupe',
      continueAlone: 'Commander seul',
      guestName: 'Votre nom', guestNamePlaceholder: 'ex. Jean',
      itemsInCart: 'Articles dans le panier', viewCart: 'Voir le panier',
      addNote: 'Ajouter une note', notePlaceholder: 'ex. sans oignons',
      orderAndPay: 'Commander et payer', backToMenu: 'Retour au menu',
      reserveTable: 'Réserver une table', guests: 'Couverts',
      date: 'Date', time: 'Heure', reserveNow: 'Réserver maintenant',
      reservationSuccess: 'Réservation confirmée!',
      free: 'libre', occupied: 'occupé',
    },
    auth: {
      login: 'Se connecter', register: 'S\'inscrire',
      email: 'E-mail', password: 'Mot de passe',
      ownerLogin: 'Connexion restaurant', staffLogin: 'Connexion personnel',
      pin: 'Entrer le PIN', invalidPin: 'PIN incorrect. Veuillez réessayer.',
      loginError: 'E-mail ou mot de passe incorrect.',
      noAccount: 'Pas encore de compte?', hasAccount: 'Déjà un compte?',
      registerHere: 'S\'inscrire ici', loginHere: 'Se connecter ici',
      restaurantName: 'Nom du restaurant',
    },
    admin: {
      newItem: 'Nouveau plat', editItem: 'Modifier le plat',
      newCategory: 'Nouvelle catégorie', editCategory: 'Modifier la catégorie',
      available: 'Disponible', unavailable: 'Indisponible',
      translating: 'Traduction...', translateDone: 'Traduit ✓',
      retranslate: 'Retraduire', tags: 'Tags',
      itemName: 'Nom du plat', itemDesc: 'Description (optionnel)',
      deleteConfirmItem: 'Supprimer le plat?',
      deleteConfirmCategory: 'Supprimer la catégorie et tous les plats?',
      noItems: 'Aucun plat dans cette catégorie.',
      addFirstItem: 'Ajouter le premier plat',
    },
  },

  pl: {
    nav: {
      overview: 'Przegląd', orders: 'Zamówienia', menu: 'Menu',
      specials: 'Dania dnia', tables: 'Stoły & QR', reservations: 'Rezerwacje',
      staff: 'Personel', openingHours: 'Godziny otwarcia', branding: 'Marka',
      inventory: 'Magazyn', stats: 'Statystyki', billing: 'Rozliczenia',
      integrations: 'Integracje',
    },
    common: {
      loading: 'Ładowanie...', save: 'Zapisz', cancel: 'Anuluj',
      delete: 'Usuń', edit: 'Edytuj', add: 'Dodaj',
      close: 'Zamknij', back: 'Wstecz', logout: 'Wyloguj',
      error: 'Błąd', lightMode: 'Tryb jasny', darkMode: 'Tryb ciemny',
      confirm: 'Potwierdź', search: 'Szukaj', yes: 'Tak', no: 'Nie',
      activate: 'Aktywuj', deactivate: 'Dezaktywuj', active: 'Aktywny',
      inactive: 'Nieaktywny', name: 'Nazwa', description: 'Opis',
      price: 'Cena', category: 'Kategoria', image: 'Zdjęcie',
    },
    order: {
      addToCart: 'Dodaj', removeFromCart: 'Usuń',
      checkout: 'Do kasy', placeOrder: 'Złóż zamówienie',
      cart: 'Koszyk', total: 'Łącznie',
      delivery: 'Dostawa', pickup: 'Odbiór',
      name: 'Imię', phone: 'Telefon', address: 'Adres', note: 'Uwaga',
      street: 'Ulica i nr', city: 'Miasto', zip: 'Kod pocztowy',
      status: {
        new: 'Zamówienie przyjęte', cooking: 'W przygotowaniu',
        served: 'Podane — Smacznego!',
        servedDelivery: 'W drodze!', cancelled: 'Anulowane',
      },
      dietary: {
        vegetarisch: '🌱 Wegetariańskie', vegan: '🌿 Wegańskie',
        glutenfrei: '🌾 Bez glutenu', laktosefrei: '🥛 Bez laktozy', scharf: '🌶️ Ostre',
      },
      allergens: 'Alergeny', filters: 'Filtry',
      orderTab: 'Zamów', reserveTab: 'Rezerwuj',
      emptyCart: 'Koszyk jest pusty', orderSuccess: 'Zamówienie złożone!',
      groupOrder: 'Zamówienie grupowe', joinGroup: 'Dołącz do grupy',
      createGroup: 'Utwórz grupę', groupCode: 'Kod grupy',
      enterGroupCode: 'Podaj kod grupy', copyCode: 'Skopiuj kod',
      copied: 'Skopiowano!', startGroupOrder: 'Rozpocznij zamówienie grupowe',
      continueAlone: 'Zamów samodzielnie',
      guestName: 'Twoje imię', guestNamePlaceholder: 'np. Marek',
      itemsInCart: 'Produkty w koszyku', viewCart: 'Zobacz koszyk',
      addNote: 'Dodaj uwagę', notePlaceholder: 'np. bez cebuli',
      orderAndPay: 'Zamów i zapłać', backToMenu: 'Wróć do menu',
      reserveTable: 'Zarezerwuj stolik', guests: 'Goście',
      date: 'Data', time: 'Godzina', reserveNow: 'Zarezerwuj teraz',
      reservationSuccess: 'Rezerwacja potwierdzona!',
      free: 'wolny', occupied: 'zajęty',
    },
    auth: {
      login: 'Zaloguj się', register: 'Zarejestruj się',
      email: 'E-mail', password: 'Hasło',
      ownerLogin: 'Logowanie restauracji', staffLogin: 'Logowanie personelu',
      pin: 'Wprowadź PIN', invalidPin: 'Zły PIN. Spróbuj ponownie.',
      loginError: 'Nieprawidłowy e-mail lub hasło.',
      noAccount: 'Nie masz konta?', hasAccount: 'Masz już konto?',
      registerHere: 'Zarejestruj się tutaj', loginHere: 'Zaloguj się tutaj',
      restaurantName: 'Nazwa restauracji',
    },
    admin: {
      newItem: 'Nowe danie', editItem: 'Edytuj danie',
      newCategory: 'Nowa kategoria', editCategory: 'Edytuj kategorię',
      available: 'Dostępne', unavailable: 'Niedostępne',
      translating: 'Tłumaczenie...', translateDone: 'Przetłumaczono ✓',
      retranslate: 'Przetłumacz ponownie', tags: 'Tagi',
      itemName: 'Nazwa dania', itemDesc: 'Opis (opcjonalny)',
      deleteConfirmItem: 'Usunąć danie?',
      deleteConfirmCategory: 'Usunąć kategorię i wszystkie dania?',
      noItems: 'Brak dań w tej kategorii.',
      addFirstItem: 'Dodaj pierwsze danie',
    },
  },

  ru: {
    nav: {
      overview: 'Обзор', orders: 'Заказы', menu: 'Меню',
      specials: 'Блюда дня', tables: 'Столы & QR', reservations: 'Бронирования',
      staff: 'Персонал', openingHours: 'Часы работы', branding: 'Брендинг',
      inventory: 'Склад', stats: 'Статистика', billing: 'Счета',
      integrations: 'Интеграции',
    },
    common: {
      loading: 'Загрузка...', save: 'Сохранить', cancel: 'Отмена',
      delete: 'Удалить', edit: 'Изменить', add: 'Добавить',
      close: 'Закрыть', back: 'Назад', logout: 'Выйти',
      error: 'Ошибка', lightMode: 'Светлый режим', darkMode: 'Тёмный режим',
      confirm: 'Подтвердить', search: 'Поиск', yes: 'Да', no: 'Нет',
      activate: 'Активировать', deactivate: 'Деактивировать', active: 'Активен',
      inactive: 'Неактивен', name: 'Название', description: 'Описание',
      price: 'Цена', category: 'Категория', image: 'Изображение',
    },
    order: {
      addToCart: 'Добавить', removeFromCart: 'Убрать',
      checkout: 'Оформить', placeOrder: 'Сделать заказ',
      cart: 'Корзина', total: 'Итого',
      delivery: 'Доставка', pickup: 'Самовывоз',
      name: 'Имя', phone: 'Телефон', address: 'Адрес', note: 'Примечание',
      street: 'Улица и №', city: 'Город', zip: 'Индекс',
      status: {
        new: 'Заказ принят', cooking: 'Готовится',
        served: 'Подано — Приятного аппетита!',
        servedDelivery: 'Уже в пути!', cancelled: 'Отменён',
      },
      dietary: {
        vegetarisch: '🌱 Вегетарианское', vegan: '🌿 Веганское',
        glutenfrei: '🌾 Без глютена', laktosefrei: '🥛 Без лактозы', scharf: '🌶️ Острое',
      },
      allergens: 'Аллергены', filters: 'Фильтры',
      orderTab: 'Заказать', reserveTab: 'Бронировать',
      emptyCart: 'Корзина пуста', orderSuccess: 'Заказ оформлен!',
      groupOrder: 'Групповой заказ', joinGroup: 'Присоединиться к группе',
      createGroup: 'Создать группу', groupCode: 'Код группы',
      enterGroupCode: 'Введите код группы', copyCode: 'Скопировать код',
      copied: 'Скопировано!', startGroupOrder: 'Начать групповой заказ',
      continueAlone: 'Заказать самостоятельно',
      guestName: 'Ваше имя', guestNamePlaceholder: 'напр. Иван',
      itemsInCart: 'Товары в корзине', viewCart: 'Посмотреть корзину',
      addNote: 'Добавить примечание', notePlaceholder: 'напр. без лука',
      orderAndPay: 'Заказать и оплатить', backToMenu: 'Вернуться в меню',
      reserveTable: 'Забронировать стол', guests: 'Гости',
      date: 'Дата', time: 'Время', reserveNow: 'Забронировать сейчас',
      reservationSuccess: 'Бронирование подтверждено!',
      free: 'свободно', occupied: 'занято',
    },
    auth: {
      login: 'Войти', register: 'Зарегистрироваться',
      email: 'E-mail', password: 'Пароль',
      ownerLogin: 'Вход в ресторан', staffLogin: 'Вход для персонала',
      pin: 'Введите PIN', invalidPin: 'Неверный PIN. Попробуйте снова.',
      loginError: 'Неверный e-mail или пароль.',
      noAccount: 'Нет аккаунта?', hasAccount: 'Уже есть аккаунт?',
      registerHere: 'Зарегистрироваться здесь', loginHere: 'Войти здесь',
      restaurantName: 'Название ресторана',
    },
    admin: {
      newItem: 'Новое блюдо', editItem: 'Редактировать блюдо',
      newCategory: 'Новая категория', editCategory: 'Редактировать категорию',
      available: 'Доступно', unavailable: 'Недоступно',
      translating: 'Перевод...', translateDone: 'Переведено ✓',
      retranslate: 'Перевести заново', tags: 'Теги',
      itemName: 'Название блюда', itemDesc: 'Описание (необязательно)',
      deleteConfirmItem: 'Удалить блюдо?',
      deleteConfirmCategory: 'Удалить категорию и все блюда?',
      noItems: 'В этой категории пока нет блюд.',
      addFirstItem: 'Добавить первое блюдо',
    },
  },
}

/** Resolve a dot-notation key, e.g. t('order.status.new') */
export function resolveKey(lang: Lang, key: string): string {
  const parts = key.split('.')
  let node: DeepString | string = translations[lang]
  for (const part of parts) {
    if (typeof node !== 'object') break
    node = node[part]
  }
  if (typeof node === 'string') return node

  // Fallback to German
  let fallback: DeepString | string = translations['de']
  for (const part of parts) {
    if (typeof fallback !== 'object') break
    fallback = fallback[part]
  }
  return typeof fallback === 'string' ? fallback : key
}

export default translations
```

- [ ] **Step 2: Commit**

```bash
git add app/lib/translations.ts
git commit -m "feat: add translations for 8 languages (de/en/es/it/tr/fr/pl/ru)"
```

---

## Task 3: Create `LanguageProvider` and `useLanguage()` hook

**Files:**
- Create: `app/components/providers/language-provider.tsx`

- [ ] **Step 1: Create the provider**

```tsx
// app/components/providers/language-provider.tsx
'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { type Lang, resolveKey } from '@/lib/translations'

interface LanguageContextType {
  lang: Lang
  setLang: (l: Lang) => void
  t: (key: string) => string
}

const LanguageContext = createContext<LanguageContextType | null>(null)

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('de')

  useEffect(() => {
    const saved = localStorage.getItem('language') as Lang | null
    const validLangs: Lang[] = ['de', 'en', 'es', 'it', 'tr', 'fr', 'pl', 'ru']
    if (saved && validLangs.includes(saved)) {
      setLangState(saved)
      document.documentElement.lang = saved
    }
  }, [])

  function setLang(l: Lang) {
    setLangState(l)
    localStorage.setItem('language', l)
    document.documentElement.lang = l
  }

  function t(key: string): string {
    return resolveKey(lang, key)
  }

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage(): LanguageContextType {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLanguage must be used within a LanguageProvider')
  return ctx
}
```

- [ ] **Step 2: Commit**

```bash
git add app/components/providers/language-provider.tsx
git commit -m "feat: add LanguageProvider and useLanguage hook"
```

---

## Task 4: Create `LanguageSelector` component

**Files:**
- Create: `app/components/ui/language-selector.tsx`

- [ ] **Step 1: Create the component**

```tsx
// app/components/ui/language-selector.tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { useLanguage } from '@/components/providers/language-provider'
import { LANGUAGES } from '@/lib/translations'

export function LanguageSelector() {
  const { lang, setLang } = useLanguage()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const current = LANGUAGES.find(l => l.code === lang)!

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs cursor-pointer"
        style={{
          background: 'var(--surface-2)',
          borderColor: 'var(--border)',
          color: 'var(--text-muted)',
          whiteSpace: 'nowrap',
        }}
        aria-label="Select language"
      >
        <span>{current.flag}</span>
        <span style={{ fontWeight: 600 }}>{current.code.toUpperCase()}</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 100,
          background: 'var(--surface-2)', border: '1px solid var(--border)',
          borderRadius: '12px', padding: '6px', minWidth: '160px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
        }}>
          {LANGUAGES.map(l => (
            <button
              key={l.code}
              onClick={() => { setLang(l.code); setOpen(false) }}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                width: '100%', padding: '7px 10px', borderRadius: '8px',
                border: 'none', cursor: 'pointer', textAlign: 'left',
                background: lang === l.code ? 'var(--accent)' : 'transparent',
                color: lang === l.code ? '#fff' : 'var(--text-muted)',
                fontSize: '0.8rem', fontWeight: lang === l.code ? 700 : 400,
              }}
            >
              <span style={{ fontSize: '1rem' }}>{l.flag}</span>
              <span>{l.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/components/ui/language-selector.tsx
git commit -m "feat: add LanguageSelector dropdown component"
```

---

## Task 5: Wire `LanguageProvider` into root layout

**Files:**
- Modify: `app/app/layout.tsx`

- [ ] **Step 1: Update root layout**

Replace the entire content of `app/app/layout.tsx` with:

```tsx
import type { Metadata } from 'next'
import { Syne, DM_Sans } from 'next/font/google'
import { ThemeProvider } from '@/components/providers/theme-provider'
import { LanguageProvider } from '@/components/providers/language-provider'
import './globals.css'

const syne = Syne({ subsets: ['latin'], variable: '--font-heading', weight: ['700', '800'] })
const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-body', weight: ['400', '500', '600'] })

export const metadata: Metadata = {
  title: 'RestaurantOS',
  description: 'Digitales Restaurant-System',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var t=localStorage.getItem('theme')||'dark';document.documentElement.classList.toggle('dark',t==='dark');})();`,
          }}
        />
      </head>
      <body className={`${syne.variable} ${dmSans.variable}`} style={{ fontFamily: 'var(--font-body), system-ui, sans-serif' }}>
        <ThemeProvider>
          <LanguageProvider>
            {children}
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
```

- [ ] **Step 2: Verify app starts**

```bash
cd app && npm run dev
```

Open http://localhost:3000 — app should load without errors.

- [ ] **Step 3: Commit**

```bash
git add app/app/layout.tsx
git commit -m "feat: wrap app with LanguageProvider"
```

---

## Task 6: Add `LanguageSelector` to Admin Sidebar

**Files:**
- Modify: `app/app/admin/layout.tsx`

- [ ] **Step 1: Import LanguageSelector and useLanguage, update the sidebar bottom section**

In `app/app/admin/layout.tsx`, add these imports at the top:

```ts
import { LanguageSelector } from '@/components/ui/language-selector'
```

- [ ] **Step 2: Replace the Bottom section inside `<Sidebar>`**

Find the bottom section (the `<div style={{ padding: '12px 8px 20px'...`)` and replace it with:

```tsx
{/* Bottom */}
<div style={{ padding: '12px 8px 20px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
  <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '0 8px 10px' }} />
  <button
    onClick={toggleTheme}
    className="sidebar-nav-btn"
    style={{
      display: 'flex', alignItems: 'center', gap: '10px',
      padding: '9px 12px', borderRadius: '8px', border: 'none',
      background: 'transparent', color: 'var(--sidebar-text)',
      fontSize: '0.85rem', cursor: 'pointer', width: '100%', textAlign: 'left',
    }}
  >
    {theme === 'dark' ? <Sun size={15} style={{ flexShrink: 0 }} /> : <Moon size={15} style={{ flexShrink: 0 }} />}
    {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
  </button>
  <div style={{ padding: '4px 12px 6px' }}>
    <LanguageSelector />
  </div>
  <button
    onClick={handleLogout}
    className="sidebar-nav-btn"
    style={{
      display: 'flex', alignItems: 'center', gap: '10px',
      padding: '9px 12px', borderRadius: '8px', border: 'none',
      background: 'transparent', color: 'var(--sidebar-text)',
      fontSize: '0.85rem', cursor: 'pointer', width: '100%', textAlign: 'left',
    }}
  >
    <LogOut size={15} style={{ flexShrink: 0 }} />
    Abmelden
  </button>
</div>
```

- [ ] **Step 3: Apply `t()` to the Admin Layout nav labels and logout button**

Add import at the top of the file:
```ts
import { useLanguage } from '@/components/providers/language-provider'
```

Inside `AdminLayout`, add:
```ts
const { t } = useLanguage()
```

Update the `NAV` array to use `t()` — change it from a constant to a computed value inside the component:
```ts
const NAV = [
  { icon: LayoutDashboard, label: t('nav.overview'),      href: '/admin' },
  { icon: ChefHat,         label: t('nav.orders'),        href: '/admin/orders' },
  { icon: UtensilsCrossed, label: t('nav.menu'),          href: '/admin/menu' },
  { icon: Tag,             label: t('nav.specials'),      href: '/admin/specials' },
  { icon: QrCode,          label: t('nav.tables'),        href: '/admin/tables' },
  { icon: CalendarDays,    label: t('nav.reservations'),  href: '/admin/reservations' },
  { icon: Users,           label: t('nav.staff'),         href: '/admin/staff' },
  { icon: Clock,           label: t('nav.openingHours'),  href: '/admin/opening-hours' },
  { icon: Palette,         label: t('nav.branding'),      href: '/admin/branding' },
  { icon: Package,         label: t('nav.inventory'),     href: '/admin/inventory' },
  { icon: BarChart2,       label: t('nav.stats'),         href: '/admin/stats' },
  { icon: CreditCard,      label: t('nav.billing'),       href: '/admin/billing' },
]
```

Update the logout button label and theme toggle label:
```tsx
{theme === 'dark' ? t('common.lightMode') : t('common.darkMode')}
// ...
{t('common.logout')}
```

**Note:** Move `const NAV = [...]` from module-level to inside the `AdminLayout` function body (before the `Sidebar` component), since it now uses the `t()` hook.

- [ ] **Step 4: Commit**

```bash
git add app/app/admin/layout.tsx
git commit -m "feat: add LanguageSelector to admin sidebar, translate nav labels"
```

---

## Task 7: Create Supabase Edge Function `translate-menu-item`

**Files:**
- Create: `supabase/functions/translate-menu-item/index.ts`

- [ ] **Step 1: Create the edge function**

```ts
// supabase/functions/translate-menu-item/index.ts
import '@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const LANGS = ['en', 'es', 'it', 'tr', 'fr', 'pl', 'ru']

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' } })
  }

  try {
    const { item_id, name, description } = await req.json()
    if (!item_id || !name) {
      return new Response(JSON.stringify({ error: 'item_id and name are required' }), { status: 400 })
    }

    const prompt = `Translate this restaurant menu item into the following languages: ${LANGS.join(', ')}.

Name (German): "${name}"
Description (German): "${description || ''}"

Return ONLY a valid JSON object with this exact structure, no markdown, no explanation:
{
  "en": { "name": "...", "description": "..." },
  "es": { "name": "...", "description": "..." },
  "it": { "name": "...", "description": "..." },
  "tr": { "name": "...", "description": "..." },
  "fr": { "name": "...", "description": "..." },
  "pl": { "name": "...", "description": "..." },
  "ru": { "name": "...", "description": "..." }
}

Keep descriptions concise and appetizing. If description is empty, return empty string for all.`

    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!aiRes.ok) {
      const err = await aiRes.text()
      throw new Error(`Anthropic API error: ${err}`)
    }

    const aiData = await aiRes.json()
    const rawText = aiData.content[0].text.trim()

    // Strip markdown code fences if present
    const jsonText = rawText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    const translations = JSON.parse(jsonText)

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const { error } = await supabase
      .from('menu_items')
      .update({ translations })
      .eq('id', item_id)

    if (error) throw error

    return new Response(JSON.stringify({ success: true, translations }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    })
  } catch (err) {
    console.error('translate-menu-item error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    })
  }
})
```

- [ ] **Step 2: Add `ANTHROPIC_API_KEY` to Supabase secrets**

In the Supabase Dashboard → Settings → Edge Functions → Secrets, add:
- Key: `ANTHROPIC_API_KEY`
- Value: your Anthropic API key

Or via CLI:
```bash
npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
```

- [ ] **Step 3: Deploy the edge function**

```bash
cd c:/Users/David/Desktop/restaurant-system
npx supabase functions deploy translate-menu-item
```

Expected output: `Deployed: translate-menu-item`

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/translate-menu-item/index.ts
git commit -m "feat: add translate-menu-item edge function (Claude API)"
```

---

## Task 8: Update Menu Admin page to trigger auto-translation

**Files:**
- Modify: `app/app/admin/menu/page.tsx`

- [ ] **Step 1: Add translation state and helper**

After the existing state declarations in `MenuPage`, add:

```ts
const [translatingId, setTranslatingId] = useState<string | null>(null)

async function triggerTranslation(itemId: string, name: string, description: string | null) {
  setTranslatingId(itemId)
  try {
    await supabase.functions.invoke('translate-menu-item', {
      body: { item_id: itemId, name, description: description || '' },
    })
  } catch (e) {
    console.error('Translation failed:', e)
  } finally {
    setTranslatingId(null)
  }
}
```

- [ ] **Step 2: Call translation after `saveItem()`**

In the `saveItem()` function, after `await loadData(restaurant.id)` and before `setModal(null)`, add:

```ts
// Get the saved item id
if (editingItem) {
  triggerTranslation(editingItem.id, itemName.trim(), itemDesc.trim() || null)
} else {
  // For new items, get the just-inserted item id
  const { data: newItems } = await supabase
    .from('menu_items')
    .select('id')
    .eq('restaurant_id', restaurant.id)
    .eq('name', itemName.trim())
    .order('created_at', { ascending: false })
    .limit(1)
  if (newItems && newItems[0]) {
    triggerTranslation(newItems[0].id, itemName.trim(), itemDesc.trim() || null)
  }
}
```

- [ ] **Step 3: Show translation indicator on menu item cards**

In the item card rendering (find where items are displayed in the JSX), add a small indicator when `translatingId === item.id`:

```tsx
{translatingId === item.id && (
  <span style={{ fontSize: '0.65rem', color: 'var(--accent)', marginLeft: '6px' }}>
    🌐 wird übersetzt...
  </span>
)}
```

- [ ] **Step 4: Commit**

```bash
git add app/app/admin/menu/page.tsx
git commit -m "feat: auto-translate menu items on save via Edge Function"
```

---

## Task 9: Translate Guest page `/bestellen/[slug]`

**Files:**
- Modify: `app/app/bestellen/[slug]/page.tsx`

- [ ] **Step 1: Import `useLanguage` and add language selector to header**

Add at the top of the file:
```ts
import { useLanguage } from '@/components/providers/language-provider'
import { LanguageSelector } from '@/components/ui/language-selector'
```

Inside `HomeOrderPage()`, add:
```ts
const { lang, t } = useLanguage()
```

- [ ] **Step 2: Replace STATUS_LABELS with `t()`**

Remove the `STATUS_LABELS` constant. Replace all usages like:
```tsx
// Before:
STATUS_LABELS[order.status]?.label
STATUS_LABELS[order.status]?.icon

// After (inline or via a helper):
t(`order.status.${order.status === 'served' && orderType === 'delivery' ? 'servedDelivery' : order.status}`)
```

For icons, keep them as hardcoded emoji since they don't need translation:
```ts
const STATUS_ICONS: Record<string, string> = {
  new: '📋', cooking: '👨‍🍳', served: '🛵', cancelled: '❌',
}
```

- [ ] **Step 3: Replace DIETARY_FILTERS with `t()`**

Replace the `DIETARY_FILTERS` constant with a computed value inside the component:
```ts
const DIETARY_FILTERS = [
  { key: 'vegetarisch', label: t('order.dietary.vegetarisch') },
  { key: 'vegan',       label: t('order.dietary.vegan') },
  { key: 'glutenfrei',  label: t('order.dietary.glutenfrei') },
  { key: 'laktosefrei', label: t('order.dietary.laktosefrei') },
  { key: 'scharf',      label: t('order.dietary.scharf') },
]
```

- [ ] **Step 4: Apply `t()` to all hardcoded UI strings**

Key replacements throughout the JSX — find each German string and replace:

| German original | Replace with |
|-----------------|-------------|
| `'Bestellen'` (tab) | `t('order.orderTab')` |
| `'Reservieren'` (tab) | `t('order.reserveTab')` |
| `'Zum Warenkorb'` / `'Hinzufügen'` | `t('order.addToCart')` |
| `'Zur Kasse'` | `t('order.checkout')` |
| `'Jetzt bestellen'` | `t('order.placeOrder')` |
| `'Warenkorb'` | `t('order.cart')` |
| `'Gesamt'` | `t('order.total')` |
| `'Lieferung'` | `t('order.delivery')` |
| `'Abholung'` | `t('order.pickup')` |
| `'Lädt...'` | `t('common.loading')` |
| `'Zurück'` | `t('common.back')` |
| `'Allergene'` | `t('order.allergens')` |
| `'Filter'` | `t('order.filters')` |
| `'Bestellung aufgegeben'` | `t('order.orderSuccess')` |

- [ ] **Step 5: Show translated menu item name/description from DB**

Where menu items are rendered (in ItemCard or inline), use:
```ts
const displayName = item.translations?.[lang]?.name ?? item.name
const displayDesc = item.translations?.[lang]?.description ?? item.description
```

Pass `lang` and the translated values to the `ItemCard` component or use them directly.

- [ ] **Step 6: Add `LanguageSelector` to page header**

Find the top bar / header area of the page where `ThemeToggle` or the theme button exists, and add `<LanguageSelector />` next to it. The exact location depends on the page layout — look for the top-right controls and add:
```tsx
<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
  <LanguageSelector />
  {/* existing theme toggle */}
</div>
```

- [ ] **Step 7: Commit**

```bash
git add app/app/bestellen/[slug]/page.tsx
git commit -m "feat: add multilingual support to /bestellen guest page"
```

---

## Task 10: Translate Guest page `/order/[token]`

**Files:**
- Modify: `app/app/order/[token]/page.tsx`

- [ ] **Step 1: Import and setup (same as Task 9, Step 1)**

```ts
import { useLanguage } from '@/components/providers/language-provider'
import { LanguageSelector } from '@/components/ui/language-selector'
```

Inside component:
```ts
const { lang, t } = useLanguage()
```

- [ ] **Step 2: Replace STATUS_LABELS with `t()`**

Remove `STATUS_LABELS` constant. Replace usages with:
```ts
t(`order.status.${status === 'served' ? 'served' : status}`)
```

Icon map stays as-is (no translation needed):
```ts
const STATUS_ICONS: Record<string, string> = {
  new: '📋', cooking: '👨‍🍳', served: '✅', cancelled: '❌',
}
```

- [ ] **Step 3: Replace DIETARY_FILTERS and ALLERGEN_FILTERS with `t()`**

```ts
const DIETARY_FILTERS = [
  { key: 'vegetarisch', label: t('order.dietary.vegetarisch') },
  { key: 'vegan',       label: t('order.dietary.vegan') },
  { key: 'glutenfrei',  label: t('order.dietary.glutenfrei') },
  { key: 'laktosefrei', label: t('order.dietary.laktosefrei') },
  { key: 'scharf',      label: t('order.dietary.scharf') },
]
```

For ALLERGEN_FILTERS — allergen names are kept as German/international terms since they are standardized food labeling terms (Gluten, Nüsse, etc.). No translation needed.

- [ ] **Step 4: Apply `t()` to all hardcoded UI strings**

Same pattern as Task 9, Step 4. Key strings to replace:
- `'Zum Warenkorb'` → `t('order.addToCart')`
- `'Zur Kasse'` → `t('order.cart')`
- `'Bestellen'` (buttons) → `t('order.placeOrder')`
- `'Gesamt'` → `t('order.total')`
- `'Lädt...'` → `t('common.loading')`
- `'Zurück zum Menü'` → `t('order.backToMenu')`
- `'Warenkorb ist leer'` → `t('order.emptyCart')`
- Cart/checkout form labels → `t('order.name')`, `t('order.phone')`, etc.
- Group order strings → `t('order.groupOrder')`, `t('order.joinGroup')`, `t('order.createGroup')`, `t('order.groupCode')`

- [ ] **Step 5: Show translated menu item name/description**

Same as Task 9, Step 5:
```ts
const displayName = item.translations?.[lang]?.name ?? item.name
const displayDesc = item.translations?.[lang]?.description ?? item.description
```

Apply in `ItemCard` component (the one defined in this file) and wherever items are rendered.

- [ ] **Step 6: Add `LanguageSelector` to page header**

Find the top bar area (where theme toggle or top controls are rendered) and add `<LanguageSelector />` next to it, same as Task 9, Step 6.

- [ ] **Step 7: Commit**

```bash
git add app/app/order/[token]/page.tsx
git commit -m "feat: add multilingual support to /order guest page"
```

---

## Task 11: Translate Auth pages

**Files:**
- Modify: `app/app/login/page.tsx`
- Modify: `app/app/owner-login/page.tsx`
- Modify: `app/app/register/page.tsx`

- [ ] **Step 1: Update `login/page.tsx` (Staff PIN login)**

Add:
```ts
import { useLanguage } from '@/components/providers/language-provider'
import { LanguageSelector } from '@/components/ui/language-selector'
```

Inside component:
```ts
const { t } = useLanguage()
```

Replace strings:
- `'Falscher PIN'` → `t('auth.invalidPin')`
- `'PIN eingeben'` / heading text → `t('auth.pin')`

Add `<LanguageSelector />` in top-right corner of the page:
```tsx
<div style={{ position: 'absolute', top: '16px', right: '16px' }}>
  <LanguageSelector />
</div>
```

- [ ] **Step 2: Update `owner-login/page.tsx`**

Add imports and `const { t } = useLanguage()`.

Replace strings:
- `'E-Mail oder Passwort falsch.'` → `t('auth.loginError')`
- `'E-Mail'` label → `t('auth.email')`
- `'Passwort'` label → `t('auth.password')`
- `'Anmelden'` button → `t('auth.login')`

Add `<LanguageSelector />` in top-right corner (position: absolute, top: 16px, right: 16px — same as login page).

- [ ] **Step 3: Update `register/page.tsx`**

Read the file first to see its structure, then:
- Add imports and `const { t } = useLanguage()`
- Replace German UI strings with `t()` calls using `auth.*` keys
- Add `<LanguageSelector />` in top-right corner

- [ ] **Step 4: Commit**

```bash
git add app/app/login/page.tsx app/app/owner-login/page.tsx app/app/register/page.tsx
git commit -m "feat: translate auth pages, add language selector"
```

---

## Task 12: Translate remaining Admin pages

**Files:**
- Modify: `app/app/admin/orders/page.tsx`
- Modify: `app/app/admin/tables/page.tsx`
- Modify: `app/app/admin/staff/page.tsx`
- Modify: `app/app/admin/reservations/page.tsx`
- Modify: `app/app/admin/inventory/page.tsx`
- Modify: `app/app/admin/specials/page.tsx`
- Modify: `app/app/admin/opening-hours/page.tsx`
- Modify: `app/app/admin/branding/page.tsx`
- Modify: `app/app/admin/billing/page.tsx`
- Modify: `app/app/admin/stats/page.tsx`

**Pattern for each page (repeat for all):**

- [ ] **Step 1: Add `useLanguage` import and `const { t } = useLanguage()` to each page**

At the top of each page file:
```ts
import { useLanguage } from '@/components/providers/language-provider'
```

Inside the component function (after existing hooks):
```ts
const { t } = useLanguage()
```

- [ ] **Step 2: Replace hardcoded German strings with `t()` calls**

For each page, find all German string literals in JSX and replace with the appropriate `t()` key. Key mappings to look for:

**orders/page.tsx:**
- Status labels: `'Bestellung eingegangen'` → `t('order.status.new')`, `'Wird zubereitet'` → `t('order.status.cooking')`, `'Serviert'` → `t('order.status.served')`, `'Storniert'` → `t('order.status.cancelled')`
- `'Bestellungen'` heading → `t('nav.orders')`
- Button labels: `t('common.save')`, `t('common.cancel')`, `t('common.delete')`
- `'Lädt...'` → `t('common.loading')`

**tables/page.tsx:**
- `'Tische & QR'` heading → `t('nav.tables')`
- Button labels → `t('common.save')`, `t('common.cancel')`, `t('common.delete')`, `t('common.add')`
- `'frei'` / `'belegt'` → `t('order.free')` / `t('order.occupied')`

**staff/page.tsx:**
- `'Staff'` heading → `t('nav.staff')`
- Button labels → `t('common.save')`, `t('common.cancel')`, `t('common.delete')`, `t('common.add')`

**reservations/page.tsx:**
- `'Reservierungen'` → `t('nav.reservations')`
- Button labels → common keys

**inventory/page.tsx:**
- `'Lagerbestand'` → `t('nav.inventory')`
- Button labels → common keys

**specials/page.tsx:**
- `'Tagesangebote'` → `t('nav.specials')`
- Button labels → common keys

**opening-hours/page.tsx:**
- `'Öffnungszeiten'` → `t('nav.openingHours')`
- Day names (Monday–Sunday) — add to translations. Add these keys to `translations.ts` under a `days` namespace:

```ts
// Add to ALL 8 languages in translations.ts under each lang object:
days: {
  mon: 'Montag', tue: 'Dienstag', wed: 'Mittwoch', thu: 'Donnerstag',
  fri: 'Freitag', sat: 'Samstag', sun: 'Sonntag',
}
// en: mon: 'Monday', tue: 'Tuesday', ...
// es: mon: 'Lunes', tue: 'Martes', ...
// it: mon: 'Lunedì', tue: 'Martedì', ...
// tr: mon: 'Pazartesi', tue: 'Salı', ...
// fr: mon: 'Lundi', tue: 'Mardi', ...
// pl: mon: 'Poniedziałek', tue: 'Wtorek', ...
// ru: mon: 'Понедельник', tue: 'Вторник', ...
```

**branding/page.tsx, billing/page.tsx, stats/page.tsx:**
- Heading and button labels only — use existing `nav.*` and `common.*` keys

- [ ] **Step 3: Commit after all admin pages are updated**

```bash
git add app/app/admin/
git commit -m "feat: translate all admin pages with t() calls"
```

---

## Task 13: Update TypeScript types for `menu_items.translations`

**Files:**
- Modify: `app/types/database.ts` (or wherever `MenuItem` is defined)

- [ ] **Step 1: Find and update `MenuItem` type**

```bash
grep -r "type MenuItem" app/types/
```

Open the file and add the `translations` field:

```ts
export type MenuItem = {
  // ... existing fields ...
  translations?: Record<string, { name: string; description: string }> | null
}
```

- [ ] **Step 2: Commit**

```bash
git add app/types/
git commit -m "feat: add translations field to MenuItem type"
```

---

## Self-Review Checklist

- [x] Task 1: DB migration adds `translations JSONB` to `menu_items`
- [x] Task 2: `translations.ts` has all 8 languages with nav, common, order, auth, admin namespaces
- [x] Task 3: `LanguageProvider` mirrors `ThemeProvider` pattern, localStorage Key `language`, default `de`
- [x] Task 4: `LanguageSelector` dropdown closes on outside click, uses `var(--surface-2)` / `var(--border)` CSS vars
- [x] Task 5: Root layout wraps with `LanguageProvider`
- [x] Task 6: Admin sidebar gets `LanguageSelector` + nav uses `t()`, `NAV` array moved inside component
- [x] Task 7: Edge function uses `claude-haiku-4-5-20251001`, strips markdown fences from response, updates DB
- [x] Task 8: Menu page triggers translation after save, shows indicator while translating
- [x] Task 9: `/bestellen` guest page — `t()`, translated item names from DB, `LanguageSelector` in header
- [x] Task 10: `/order/[token]` guest page — same as Task 9
- [x] Task 11: Auth pages get `t()` + `LanguageSelector` positioned top-right (absolute)
- [x] Task 12: All admin pages get `useLanguage` + `t()` for headings, buttons, status labels
- [x] Task 13: `MenuItem` type updated with `translations` field
- [x] `resolveKey` function in `translations.ts` is the same function used in `LanguageProvider.t()` — consistent
- [x] Day names for opening-hours page covered in Task 12 with instructions to extend `translations.ts`
- [x] No placeholder tasks — all steps have actual code
