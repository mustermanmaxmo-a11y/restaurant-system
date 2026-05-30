import crypto from 'crypto'

type Prefix = 'BDAY' | 'ANNI' | 'EVT'

export function generateDiscountCode(prefix: Prefix): string {
  const random = crypto.randomBytes(5).toString('hex').toUpperCase()
  return `${prefix}-${random}`
}
