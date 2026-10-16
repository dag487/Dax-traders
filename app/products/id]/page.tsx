type ProductPageProps = {
  params: { id: string };
};

export default function ProductPage({ params }: ProductPageProps) {
  const { id } = params;
  return <h1>Product ID: {id}</h1>;
}
