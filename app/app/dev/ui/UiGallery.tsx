'use client'

import { useState } from 'react'
import { Package, Search, Plus, Trash2, Sparkles } from 'lucide-react'
import {
  Button, IconButton, Input, Textarea, Select, Field, Card, CardHeader, CardTitle,
  CardDescription, CardFooter, Badge, StatusPill, Modal, PageHeader, EmptyState,
  Skeleton, SkeletonText, StatCard, Table, THead, TBody, TR, TH, TD, Tabs,
  ToastProvider, useToast,
} from '@/components/ui'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-muted">{title}</h2>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </section>
  )
}

function ToastDemo() {
  const toast = useToast()
  return (
    <>
      <Button variant="secondary" onClick={() => toast({ title: 'Gespeichert', tone: 'success' })}>Success-Toast</Button>
      <Button variant="secondary" onClick={() => toast({ title: 'Fehlgeschlagen', description: 'Prüfe deine Verbindung.', tone: 'error' })}>Error-Toast</Button>
    </>
  )
}

export function UiGallery() {
  const [modalOpen, setModalOpen] = useState(false)
  const [tab, setTab] = useState('orders')

  return (
    <ToastProvider>
      <main className="mx-auto max-w-4xl px-6 py-10">
        <PageHeader
          icon={<Package size={18} />}
          title="UI-Primitives"
          description="Interne Vorschau. Alle Bausteine nutzen die Design-Tokens aus globals.css."
          actions={<Button size="sm"><Plus size={16} /> Aktion</Button>}
        />

        <Section title="Buttons">
          <Button>Primär</Button>
          <Button variant="secondary">Sekundär</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="danger"><Trash2 size={16} /> Löschen</Button>
          <Button variant="link">Link</Button>
          <Button loading>Lädt</Button>
          <IconButton aria-label="Suchen" variant="secondary"><Search size={18} /></IconButton>
          <Button size="sm">Klein</Button>
          <Button size="lg"><Sparkles size={18} /> Groß</Button>
        </Section>

        <Section title="Badges & Status">
          <Badge>Neutral</Badge>
          <Badge tone="accent">Akzent</Badge>
          <Badge tone="success">Erfolg</Badge>
          <Badge tone="warn">Warnung</Badge>
          <Badge tone="danger">Gefahr</Badge>
          <StatusPill status="new" />
          <StatusPill status="cooking" />
          <StatusPill status="served" />
          <StatusPill status="cancelled" />
        </Section>

        <Section title="Formularfelder">
          <div className="grid w-full gap-4 sm:grid-cols-2">
            <Field label="E-Mail" hint="Wir senden dir eine Bestätigung."><Input type="email" placeholder="chef@restaurant.de" /></Field>
            <Field label="Passwort" error="Mindestens 8 Zeichen."><Input type="password" defaultValue="123" /></Field>
            <Field label="Kategorie"><Select><option>Vorspeise</option><option>Hauptgericht</option></Select></Field>
            <Field label="Notiz"><Textarea placeholder="Optional …" /></Field>
          </div>
        </Section>

        <Section title="Karten & Kennzahlen">
          <div className="grid w-full gap-4 sm:grid-cols-3">
            <StatCard label="Umsatz heute" value="1.284 €" trend={12} sub="ggü. Vortag" />
            <StatCard label="Bestellungen" value="47" trend={-3} />
            <StatCard label="Ø Bewertung" value="4,7" sub="letzte 30 Tage" />
          </div>
          <Card className="w-full">
            <CardHeader>
              <div><CardTitle>Karten-Baustein</CardTitle><CardDescription>Mit Header und Footer.</CardDescription></div>
              <Badge tone="accent">Pro</Badge>
            </CardHeader>
            <p className="text-sm text-muted">Inhalt der Karte.</p>
            <CardFooter><Button size="sm" variant="ghost">Abbrechen</Button><Button size="sm">Speichern</Button></CardFooter>
          </Card>
        </Section>

        <Section title="Tabs">
          <div className="w-full">
            <Tabs value={tab} onValueChange={setTab} items={[
              { key: 'orders', label: 'Bestellungen', badge: 3 },
              { key: 'menu', label: 'Speisekarte' },
              { key: 'stats', label: 'Statistiken' },
            ]} />
            <p className="mt-3 text-sm text-muted">Aktiv: {tab}</p>
          </div>
        </Section>

        <Section title="Tabelle">
          <Table>
            <THead><TR><TH>Gericht</TH><TH>Preis</TH><TH>Status</TH></TR></THead>
            <TBody>
              <TR><TD>Margherita</TD><TD>9,50 €</TD><TD><StatusPill status="served" /></TD></TR>
              <TR><TD>Carbonara</TD><TD>12,00 €</TD><TD><StatusPill status="cooking" /></TD></TR>
            </TBody>
          </Table>
        </Section>

        <Section title="Leerzustand & Skeleton">
          <div className="grid w-full gap-4 sm:grid-cols-2">
            <EmptyState icon={<Package size={22} />} title="Keine Bestellungen" description="Sobald Gäste bestellen, erscheinen sie hier." action={<Button size="sm">QR-Codes drucken</Button>} />
            <Card><div className="flex items-center gap-3"><Skeleton className="h-10 w-10 rounded-full" /><div className="flex-1"><SkeletonText lines={2} /></div></div></Card>
          </div>
        </Section>

        <Section title="Modal & Toast">
          <Button onClick={() => setModalOpen(true)}>Modal öffnen</Button>
          <ToastDemo />
        </Section>

        <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Beispiel-Dialog" description="Escape schließt, Klick auf den Hintergrund auch."
          footer={<><Button variant="ghost" onClick={() => setModalOpen(false)}>Abbrechen</Button><Button onClick={() => setModalOpen(false)}>Bestätigen</Button></>}>
          <p className="text-sm text-muted">Dies ist der Inhalt des Dialogs. Er scrollt bei Bedarf innerhalb des Panels.</p>
        </Modal>
      </main>
    </ToastProvider>
  )
}
