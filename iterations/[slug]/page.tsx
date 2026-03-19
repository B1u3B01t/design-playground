import { notFound } from 'next/navigation';
import { flatRegistry } from '../../registry';
import { getIterationComponent } from '..';
import type { ComponentSize } from '../../lib/constants';

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

const isFullPage = (size?: ComponentSize) => size === 'laptop' || size === 'tablet' || size === 'mobile';

function ScreenFrame({ children, useAppTheme, size }: { children: React.ReactNode; useAppTheme?: boolean; size?: ComponentSize }) {
  const full = isFullPage(size);

  return (
    <div className="fixed inset-0 bg-gray-100 p-4">
      <div className={`${useAppTheme ? 'app-theme' : ''} w-full h-full overflow-auto rounded-2xl border border-gray-300 bg-background shadow-sm`}>
        <div className={full ? 'min-h-full' : 'grid min-h-full place-items-center p-[5%]'}>
          {children}
        </div>
      </div>
    </div>
  );
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
      <ScreenFrame useAppTheme={registryItem?.useAppTheme} size={registryItem?.size}>
        <IterationComponent {...props} />
      </ScreenFrame>
    );
  }

  // 2) Fall back to rendering a registry component by id
  const registryItem = flatRegistry[slug];
  if (!registryItem) {
    notFound();
  }

  const { Component, props, useAppTheme, size } = registryItem;
  const effectiveProps = (props ?? {}) as Record<string, unknown>;

  return (
    <ScreenFrame useAppTheme={useAppTheme} size={size}>
      <Component {...effectiveProps} />
    </ScreenFrame>
  );
}
