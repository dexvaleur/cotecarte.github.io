import { Minus, Plus, Trash2 } from 'lucide-react'
import { CONDITIONS } from '../data/cardInfo'
import { type CollectionItem, keepOnlyOne, removeCard, removeItem, updateItem } from '../lib/collection'
import { Card as Box } from './ui'

/** Moins un exemplaire ; au dernier, on demande confirmation avant de retirer la carte. */
export function decrement(item: CollectionItem) {
  if (item.quantity > 1) return updateItem(item.uid, { quantity: item.quantity - 1 })
  if (confirm(`Retirer ${item.name} (${CONDITIONS[item.condition].short}) de ta collection ?`)) removeItem(item.uid)
}

/** Fiche carte : les exemplaires possédés, avec +/−, suppression et « garder 1 seul ». */
export function OwnedCopies({ items }: { items: CollectionItem[] }) {
  if (!items.length) return null
  const total = items.reduce((n, c) => n + c.quantity, 0)
  const name = items[0].name
  const cardId = items[0].cardId
  return (
    <Box>
      <h2 className="font-bold">Dans ta collection</h2>
      <p className="mb-2 text-sm text-muted">
        Tu as {total} exemplaire{total > 1 ? 's' : ''} de cette carte.
      </p>
      <ul className="divide-y divide-line">
        {items.map((item) => (
          <li key={item.uid} className="flex items-center gap-3 py-2">
            <span className="min-w-0 flex-1">
              <b>{CONDITIONS[item.condition].short}</b>{' '}
              <span className="text-sm text-muted">· {CONDITIONS[item.condition].label}</span>
            </span>
            <div className="flex items-center rounded-xl border border-line">
              <button onClick={() => decrement(item)} aria-label="Un de moins" className="px-2.5 py-1.5">
                <Minus size={16} />
              </button>
              <span className="min-w-6 text-center font-bold">{item.quantity}</span>
              <button onClick={() => updateItem(item.uid, { quantity: item.quantity + 1 })} aria-label="Un de plus" className="px-2.5 py-1.5">
                <Plus size={16} />
              </button>
            </div>
            <button
              onClick={() => confirm(`Retirer ${item.quantity > 1 ? `les ${item.quantity} exemplaires` : 'cet exemplaire'} ${CONDITIONS[item.condition].short} ?`) && removeItem(item.uid)}
              aria-label={`Retirer les ${CONDITIONS[item.condition].short}`}
              className="p-1.5 text-muted"
            >
              <Trash2 size={18} />
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap gap-2">
        {total > 1 && (
          <button
            onClick={() =>
              confirm(`Garder un seul ${name} (celui en meilleur état) et retirer les ${total - 1} autres ?`) &&
              keepOnlyOne(cardId, (c) => CONDITIONS[c.condition].factor)
            }
            className="flex-1 rounded-2xl bg-primary-soft px-3 py-2.5 font-bold text-primary"
          >
            Garder 1 seul exemplaire
          </button>
        )}
        <button
          onClick={() => confirm(`Retirer ${name} de ta collection (${total} exemplaire${total > 1 ? 's' : ''}) ?`) && removeCard(cardId)}
          className="flex-1 rounded-2xl border border-line px-3 py-2.5 font-semibold text-bad"
        >
          Tout retirer
        </button>
      </div>
    </Box>
  )
}
