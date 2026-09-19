import Shell from "@/components/Shell";

export default async function PageBySlug({ params }: PageProps<"/p/[slug]">) {
  const { slug } = await params;
  return <Shell slug={slug} />;
}
