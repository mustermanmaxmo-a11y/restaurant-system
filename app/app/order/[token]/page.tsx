export default async function OrderPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  return (
    <main className="min-h-screen flex items-center justify-center">
      <p>Dine-In Order — Token: {token}</p>
    </main>
  )
}
