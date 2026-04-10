'use client'

import { motion, AnimatePresence } from 'framer-motion'
import type { MenuItem } from '@/types/database'
import type { LayoutVariant } from '@/lib/design-packages'
import type { ColorSet } from '@/lib/color-utils'

const spring = { type: 'spring' as const, stiffness: 420, damping: 26 }
const springBouncy = { type: 'spring' as const, stiffness: 500, damping: 18 }

export interface MenuItemCardProps {
  item: MenuItem
  qty: number
  layout: LayoutVariant
  /** Pass either a ColorSet object or undefined to use CSS variables */
  colors?: ColorSet
  special?: { label: string; special_price: number | null }
  displayName: string
  displayDesc: string | null
  index: number
  onAdd: () => void
  onRemove: () => void
  onOpen: () => void
  isFavorite?: boolean
  onToggleFavorite?: () => void
}

// Helpers: resolve color — either from ColorSet or CSS variable fallback
function c(colors: ColorSet | undefined, key: keyof ColorSet, cssVar: string): string {
  return colors ? colors[key] : `var(${cssVar})`
}

// ─── Cards Layout (Standard — matches current design exactly) ────────────────
function CardsLayout(props: MenuItemCardProps) {
  const { item, qty, colors, special, displayName, displayDesc, index, onAdd, onRemove, onOpen, isFavorite, onToggleFavorite } = props
  const inCart = qty > 0
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, ...spring }}
      whileHover={{ y: -4, scale: 1.01, rotate: 0.4 }}
      whileTap={{ scale: 0.97 }}
      onClick={onOpen}
      style={{
        background: c(colors, 'cardBg', '--surface'),
        borderRadius: '16px',
        padding: '14px',
        display: 'flex',
        gap: '14px',
        alignItems: 'center',
        border: inCart ? `1.5px solid ${c(colors, 'accent', '--accent')}` : '1.5px solid transparent',
        boxShadow: inCart ? '0 2px 12px rgba(0,0,0,0.08)' : '0 1px 4px rgba(0,0,0,0.06)',
        cursor: 'pointer',
      }}
    >
      {item.image_url && (
        <img src={item.image_url} alt={displayName} style={{ width: '72px', height: '72px', borderRadius: '10px', objectFit: 'cover', flexShrink: 0 }} />
      )}
      <ItemTextBlock colors={colors} displayName={displayName} displayDesc={displayDesc} item={item} special={special} />
      <ItemActions colors={colors} qty={qty} onAdd={onAdd} onRemove={onRemove} isFavorite={isFavorite} onToggleFavorite={onToggleFavorite} />
    </motion.div>
  )
}

// ─── List Layout (compact, high-density) ─────────────────────────────────────
function ListLayout(props: MenuItemCardProps) {
  const { item, qty, colors, special, displayName, displayDesc, index, onAdd, onRemove, onOpen, isFavorite, onToggleFavorite } = props
  const inCart = qty > 0
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03, ...spring }}
      whileHover={{ x: 4, transition: { duration: 0.15 } }}
      onClick={onOpen}
      style={{
        background: c(colors, 'cardBg', '--surface'),
        borderRadius: '12px',
        padding: '12px 14px',
        display: 'flex',
        gap: '12px',
        alignItems: 'center',
        borderLeft: inCart ? `3px solid ${c(colors, 'accent', '--accent')}` : '3px solid transparent',
        borderTop: 'none', borderRight: 'none', borderBottom: 'none',
        cursor: 'pointer',
        transition: 'border-color 0.2s ease',
      }}
    >
      {item.image_url && (
        <img src={item.image_url} alt={displayName} style={{ width: '44px', height: '44px', borderRadius: '8px', objectFit: 'cover', flexShrink: 0 }} />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: displayDesc ? '2px' : 0 }}>
          {special && (
            <span style={{ background: '#f59e0b18', color: '#f59e0b', fontSize: '0.62rem', fontWeight: 700, padding: '1px 5px', borderRadius: '4px' }}>🔥</span>
          )}
          <p style={{ color: c(colors, 'text', '--text'), fontWeight: 600, fontSize: '0.88rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{displayName}</p>
          {special?.special_price != null ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
              <span style={{ color: c(colors, 'accent', '--accent'), fontWeight: 700, fontSize: '0.88rem' }}>{Number(special.special_price).toFixed(2)} €</span>
              <span style={{ color: c(colors, 'muted', '--text-muted'), fontSize: '0.72rem', textDecoration: 'line-through' }}>{item.price.toFixed(2)} €</span>
            </div>
          ) : (
            <span style={{ color: c(colors, 'accent', '--accent'), fontWeight: 700, fontSize: '0.88rem', flexShrink: 0 }}>{item.price.toFixed(2)} €</span>
          )}
        </div>
        {displayDesc && (
          <p style={{ color: c(colors, 'muted', '--text-muted'), fontSize: '0.72rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.3 }}>{displayDesc}</p>
        )}
      </div>
      <ItemActions colors={colors} qty={qty} onAdd={onAdd} onRemove={onRemove} compact isFavorite={isFavorite} onToggleFavorite={onToggleFavorite} />
    </motion.div>
  )
}

// ─── Large Cards Layout (big image on top) ───────────────────────────────────
function LargeCardsLayout(props: MenuItemCardProps) {
  const { item, qty, colors, special, displayName, displayDesc, index, onAdd, onRemove, onOpen, isFavorite, onToggleFavorite } = props
  const inCart = qty > 0
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, ...spring }}
      whileHover={{ y: -6, transition: { duration: 0.2 } }}
      whileTap={{ scale: 0.98 }}
      onClick={onOpen}
      style={{
        background: c(colors, 'cardBg', '--surface'),
        borderRadius: '18px',
        overflow: 'hidden',
        border: inCart ? `2px solid ${c(colors, 'accent', '--accent')}` : `1px solid ${c(colors, 'border', '--border')}`,
        cursor: 'pointer',
        boxShadow: inCart ? `0 4px 20px ${colors?.accentGlow ?? 'rgba(0,0,0,0.12)'}` : '0 2px 8px rgba(0,0,0,0.06)',
        transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
      }}
    >
      {item.image_url ? (
        <div style={{ position: 'relative', width: '100%', height: '160px', overflow: 'hidden' }}>
          <img src={item.image_url} alt={displayName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          {special && (
            <span style={{
              position: 'absolute', top: '10px', left: '10px',
              background: '#f59e0b', color: '#fff', fontSize: '0.7rem', fontWeight: 700,
              padding: '3px 8px', borderRadius: '6px', letterSpacing: '0.02em',
            }}>🔥 {special.label}</span>
          )}
        </div>
      ) : (
        <div style={{ width: '100%', height: '100px', background: c(colors, 'surface2', '--surface-2'), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: '2.5rem', opacity: 0.2 }}>🍽</span>
        </div>
      )}
      <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'flex-end', gap: '10px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ color: c(colors, 'text', '--text'), fontWeight: 700, fontSize: '1rem', marginBottom: '4px' }}>{displayName}</p>
          {displayDesc && (
            <p style={{ color: c(colors, 'muted', '--text-muted'), fontSize: '0.78rem', marginBottom: '6px', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{displayDesc}</p>
          )}
          {item.tags.length > 0 && (
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '6px' }}>
              {item.tags.slice(0, 3).map(tag => (
                <span key={tag} style={{ background: c(colors, 'surface2', '--surface-2'), color: c(colors, 'muted', '--text-muted'), fontSize: '0.62rem', padding: '2px 7px', borderRadius: '5px', fontWeight: 600 }}>{tag}</span>
              ))}
            </div>
          )}
          {special?.special_price != null ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
              <p style={{ color: c(colors, 'accent', '--accent'), fontWeight: 800, fontSize: '1.05rem' }}>{Number(special.special_price).toFixed(2)} €</p>
              <p style={{ color: c(colors, 'muted', '--text-muted'), fontWeight: 500, fontSize: '0.8rem', textDecoration: 'line-through' }}>{item.price.toFixed(2)} €</p>
            </div>
          ) : (
            <p style={{ color: c(colors, 'accent', '--accent'), fontWeight: 800, fontSize: '1.05rem' }}>{item.price.toFixed(2)} €</p>
          )}
        </div>
        <div onClick={e => e.stopPropagation()}>
          <ItemActions colors={colors} qty={qty} onAdd={onAdd} onRemove={onRemove} isFavorite={isFavorite} onToggleFavorite={onToggleFavorite} />
        </div>
      </div>
    </motion.div>
  )
}

// ─── Grid Layout (2-column, square-ish cards) ────────────────────────────────
function GridLayout(props: MenuItemCardProps) {
  const { item, qty, colors, special, displayName, index, onAdd, onRemove, onOpen } = props
  const inCart = qty > 0
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.04, ...spring }}
      whileHover={{ scale: 1.03, transition: { duration: 0.15 } }}
      whileTap={{ scale: 0.96 }}
      onClick={onOpen}
      style={{
        background: c(colors, 'cardBg', '--surface'),
        borderRadius: '14px',
        overflow: 'hidden',
        border: inCart ? `1.5px solid ${c(colors, 'accent', '--accent')}` : `1px solid ${c(colors, 'border', '--border')}`,
        cursor: 'pointer',
        transition: 'border-color 0.2s ease',
      }}
    >
      {item.image_url ? (
        <div style={{ position: 'relative', width: '100%', aspectRatio: '1', overflow: 'hidden' }}>
          <img src={item.image_url} alt={displayName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          {special && (
            <span style={{
              position: 'absolute', top: '6px', left: '6px',
              background: '#f59e0b', color: '#fff', fontSize: '0.6rem', fontWeight: 700,
              padding: '2px 6px', borderRadius: '5px',
            }}>🔥</span>
          )}
        </div>
      ) : (
        <div style={{ width: '100%', aspectRatio: '1', background: c(colors, 'surface2', '--surface-2'), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: '2rem', opacity: 0.2 }}>🍽</span>
        </div>
      )}
      <div style={{ padding: '10px 10px 12px' }}>
        <p style={{ color: c(colors, 'text', '--text'), fontWeight: 700, fontSize: '0.82rem', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {special?.special_price != null ? (
            <span style={{ color: c(colors, 'accent', '--accent'), fontWeight: 800, fontSize: '0.88rem' }}>{Number(special.special_price).toFixed(2)} €</span>
          ) : (
            <span style={{ color: c(colors, 'accent', '--accent'), fontWeight: 800, fontSize: '0.88rem' }}>{item.price.toFixed(2)} €</span>
          )}
          <div onClick={e => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <AnimatePresence mode="popLayout">
              {qty > 0 && (
                <motion.button
                  key="minus"
                  initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }}
                  transition={springBouncy}
                  onClick={onRemove}
                  style={{ width: '26px', height: '26px', borderRadius: '50%', background: c(colors, 'surface2', '--surface-2'), border: 'none', color: c(colors, 'text', '--text'), cursor: 'pointer', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}
                >−</motion.button>
              )}
            </AnimatePresence>
            <AnimatePresence mode="popLayout">
              {qty > 0 && (
                <motion.span
                  key={qty}
                  initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.4, opacity: 0 }}
                  transition={springBouncy}
                  style={{ color: c(colors, 'text', '--text'), fontWeight: 800, minWidth: '14px', textAlign: 'center', fontSize: '0.78rem' }}
                >{qty}</motion.span>
              )}
            </AnimatePresence>
            <motion.button
              onClick={onAdd}
              whileTap={{ scale: 0.78 }}
              transition={springBouncy}
              style={{ width: '28px', height: '28px', borderRadius: '50%', background: c(colors, 'accent', '--accent'), border: 'none', color: '#fff', cursor: 'pointer', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}
            >+</motion.button>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Shared: Item text block ─────────────────────────────────────────────────
function ItemTextBlock({ colors, displayName, displayDesc, item, special }: {
  colors?: ColorSet; displayName: string; displayDesc: string | null; item: MenuItem
  special?: { label: string; special_price: number | null }
}) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      {special && (
        <span style={{ display: 'inline-block', background: '#f59e0b18', color: '#f59e0b', fontSize: '0.68rem', fontWeight: 700, padding: '2px 7px', borderRadius: '6px', marginBottom: '4px', letterSpacing: '0.02em' }}>
          🔥 {special.label}
        </span>
      )}
      <p style={{ color: c(colors, 'text', '--text'), fontWeight: 700, marginBottom: '3px', fontSize: '0.95rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</p>
      {displayDesc && (
        <p style={{ color: c(colors, 'muted', '--text-muted'), fontSize: '0.78rem', marginBottom: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.4 }}>{displayDesc}</p>
      )}
      {item.tags.length > 0 && (
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '6px' }}>
          {item.tags.slice(0, 3).map(tag => (
            <span key={tag} style={{ background: c(colors, 'surface2', '--surface-2'), color: c(colors, 'muted', '--text-muted'), fontSize: '0.65rem', padding: '2px 7px', borderRadius: '6px', fontWeight: 600 }}>{tag}</span>
          ))}
        </div>
      )}
      {special?.special_price != null ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
          <p style={{ color: c(colors, 'accent', '--accent'), fontWeight: 800, fontSize: '0.95rem' }}>{Number(special.special_price).toFixed(2)} €</p>
          <p style={{ color: c(colors, 'muted', '--text-muted'), fontWeight: 500, fontSize: '0.8rem', textDecoration: 'line-through' }}>{item.price.toFixed(2)} €</p>
        </div>
      ) : (
        <p style={{ color: c(colors, 'accent', '--accent'), fontWeight: 800, fontSize: '0.95rem' }}>{item.price.toFixed(2)} €</p>
      )}
    </div>
  )
}

// ─── Shared: +/- action buttons ──────────────────────────────────────────────
function ItemActions({ colors, qty, onAdd, onRemove, compact, isFavorite, onToggleFavorite }: {
  colors?: ColorSet; qty: number; onAdd: () => void; onRemove: () => void
  compact?: boolean; isFavorite?: boolean; onToggleFavorite?: () => void
}) {
  const size = compact ? '28px' : '32px'
  const fontSize = compact ? '1rem' : '1.2rem'
  return (
    <div onClick={e => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: compact ? '4px' : '5px', flexShrink: 0 }}>
      {onToggleFavorite && (
        <motion.button
          onClick={onToggleFavorite}
          whileTap={{ scale: 0.78 }}
          transition={springBouncy}
          style={{ width: size, height: size, borderRadius: '50%', background: 'none', border: 'none', fontSize: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isFavorite ? c(colors, 'accent', '--accent') : c(colors, 'muted2', '--text-muted') }}
        >{isFavorite ? '♥' : '♡'}</motion.button>
      )}
      <AnimatePresence mode="popLayout">
        {qty > 0 && (
          <motion.button
            key="minus"
            initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }}
            transition={springBouncy}
            onClick={onRemove}
            style={{ width: size, height: size, borderRadius: '50%', background: c(colors, 'surface2', '--surface-2'), border: `1px solid ${c(colors, 'border', '--border')}`, color: c(colors, 'text', '--text'), cursor: 'pointer', fontSize, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}
          >−</motion.button>
        )}
      </AnimatePresence>
      <AnimatePresence mode="popLayout">
        {qty > 0 && (
          <motion.span
            key={qty}
            initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.4, opacity: 0 }}
            transition={springBouncy}
            style={{ color: c(colors, 'text', '--text'), fontWeight: 800, minWidth: compact ? '14px' : '18px', textAlign: 'center', fontSize: compact ? '0.82rem' : '0.9rem' }}
          >{qty}</motion.span>
        )}
      </AnimatePresence>
      <motion.button
        onClick={onAdd}
        whileTap={{ scale: 0.78 }}
        whileHover={{ scale: 1.15 }}
        transition={springBouncy}
        style={{ width: size, height: size, borderRadius: '50%', background: c(colors, 'accent', '--accent'), border: 'none', color: '#fff', cursor: 'pointer', fontSize, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, boxShadow: qty > 0 ? `0 2px 12px ${colors?.accentGlow ?? 'rgba(0,0,0,0.1)'}` : 'none' }}
      >+</motion.button>
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────
export function MenuItemCard(props: MenuItemCardProps) {
  switch (props.layout) {
    case 'list':        return <ListLayout {...props} />
    case 'large-cards': return <LargeCardsLayout {...props} />
    case 'grid':        return <GridLayout {...props} />
    case 'cards':
    default:            return <CardsLayout {...props} />
  }
}
