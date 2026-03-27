export default function OrderPage({ params }: { params: { token: string } }) {
  return (
    <main className="min-h-screen flex items-center justify-center">
      <p>Dine-In Order — Token: {params.token}</p>
    </main>
  )
}
