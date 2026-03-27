export default async function HomeOrderPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  return (
    <main className="min-h-screen flex items-center justify-center">
      <p>Home Ordering — Restaurant: {slug}</p>
    </main>
  )
}
