export default function HomeOrderPage({ params }: { params: { slug: string } }) {
  return (
    <main className="min-h-screen flex items-center justify-center">
      <p>Home Ordering — Restaurant: {params.slug}</p>
    </main>
  )
}
