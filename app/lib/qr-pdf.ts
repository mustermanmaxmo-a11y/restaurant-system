import jsPDF from 'jspdf'
import QRCode from 'qrcode'

interface QrPdfOptions {
  restaurantName: string
  logoUrl?: string | null
  tables: Array<{ table_num: number; label: string; qr_token: string }>
  baseUrl: string
}

export async function generateQrPdf(options: QrPdfOptions): Promise<void> {
  const { restaurantName, logoUrl, tables, baseUrl } = options
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageWidth = 210

  let logoBase64: string | null = null
  if (logoUrl) {
    try {
      const response = await fetch(logoUrl)
      const blob = await response.blob()
      logoBase64 = await new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result as string)
        reader.readAsDataURL(blob)
      })
    } catch {
      // Logo fetch failed — continue without logo
    }
  }

  for (let i = 0; i < tables.length; i++) {
    const table = tables[i]
    if (i > 0) doc.addPage()

    const qrUrl = `${baseUrl}/order/${table.qr_token}`

    const qrDataUrl = await QRCode.toDataURL(qrUrl, {
      width: 300,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    })

    let yPos = 35

    if (logoBase64) {
      try {
        doc.addImage(logoBase64, 'PNG', pageWidth / 2 - 15, yPos, 30, 30)
        yPos += 35
      } catch {
        doc.setFontSize(22)
        doc.setFont('helvetica', 'bold')
        doc.text(restaurantName, pageWidth / 2, yPos + 10, { align: 'center' })
        yPos += 20
      }
    } else {
      doc.setFontSize(22)
      doc.setFont('helvetica', 'bold')
      doc.text(restaurantName, pageWidth / 2, yPos + 10, { align: 'center' })
      yPos += 20
    }

    if (logoBase64) {
      doc.setFontSize(18)
      doc.setFont('helvetica', 'bold')
      doc.text(restaurantName, pageWidth / 2, yPos + 5, { align: 'center' })
      yPos += 15
    }

    yPos += 10

    const qrSize = 80
    const qrX = (pageWidth - qrSize) / 2
    doc.addImage(qrDataUrl, 'PNG', qrX, yPos, qrSize, qrSize)
    yPos += qrSize + 12

    doc.setFontSize(20)
    doc.setFont('helvetica', 'bold')
    doc.text(table.label, pageWidth / 2, yPos, { align: 'center' })
    yPos += 20

    doc.setDrawColor(200, 200, 200)
    doc.setLineWidth(0.3)
    doc.line(40, yPos, pageWidth - 40, yPos)
    yPos += 15

    doc.setFontSize(12)
    doc.setFont('helvetica', 'normal')
    doc.text(
      'Scannen Sie den QR-Code, um die',
      pageWidth / 2, yPos, { align: 'center' }
    )
    yPos += 6
    doc.text(
      'Speisekarte zu öffnen und zu bestellen.',
      pageWidth / 2, yPos, { align: 'center' }
    )
    yPos += 14

    doc.setFontSize(10)
    doc.setTextColor(130, 130, 130)
    doc.text(
      'Scan the QR code to open the menu',
      pageWidth / 2, yPos, { align: 'center' }
    )
    yPos += 5
    doc.text(
      'and place your order.',
      pageWidth / 2, yPos, { align: 'center' }
    )
    doc.setTextColor(0, 0, 0)
  }

  doc.save(`${restaurantName.replace(/[^a-zA-Z0-9]/g, '-')}-QR-Codes.pdf`)
}
