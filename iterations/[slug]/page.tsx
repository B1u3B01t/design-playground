import { notFound } from 'next/navigation';
import { flatRegistry } from '../../registry';
import { getIterationComponent } from '..';

interface IterationPageProps {
  params: Promise<{
    slug: string;
  }>;
}

function getRegistryItemForIteration(filename: string) {
  const baseName = filename.replace(/\.tsx$/, '').split('.')[0]; // e.g. "PricingCard"
  const kebab = baseName.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '');

  const possibleIds = [
    kebab,
    `${kebab}-expanded`,
    `${kebab}-minimal`,
  ];

  for (const id of possibleIds) {
    const item = flatRegistry[id];
    if (item) return item;
  }

  return undefined;
}

export default async function PlaygroundIterationIsolatedPage({ params }: IterationPageProps) {
  const { slug } = await params;

  // 1) Try to resolve as an iteration first (by filename)
  const iterationFilename = `${slug}.tsx`;
  const IterationComponent = getIterationComponent(iterationFilename);

  if (IterationComponent) {
    const registryItem = getRegistryItemForIteration(iterationFilename);
    const props = (registryItem?.props ?? {}) as Record<string, unknown>;

    return (
      <div className="m-2 border border-gray-300 rounded-3xl p-4">
        <IterationComponent {...props} />
      </div>
    );
  }

  // 2) Fall back to rendering a registry component by id
  const registryItem = flatRegistry[slug];
  if (!registryItem) {
    notFound();
  }

  const { Component, props, label } = registryItem;
  const effectiveProps = (props ?? {}) as Record<string, unknown>;

  return (
    <div className="m-4 border border-gray-200 rounded-lg p-3">
      <Component {...effectiveProps} />
    </div>
  );
}

