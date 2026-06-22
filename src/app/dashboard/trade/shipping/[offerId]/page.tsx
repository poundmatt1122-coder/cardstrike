import ShippingClient from "../ShippingClient";

export default async function ShippingPage({ params }: { params: Promise<{ offerId: string }> }) {
  const { offerId } = await params;
  return <ShippingClient offerId={offerId} />;
}
