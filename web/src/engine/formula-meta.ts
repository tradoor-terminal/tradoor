/** Read off a formula run's text, apart from the module so a test can read it too. */

/** The markets a run asked for and was not given (`want`), and the ones given that it read (`read`). */
export function othersOf(meta: string, wanted: Set<string>, read: Set<string>): void {
  for (const m of meta.matchAll(/^(want|read)\t(.+)$/gm)) (m[1] === 'want' ? wanted : read).add(m[2]!);
}

/** Its name in the legend: the title it gives itself in place of its name and settings, its author's mark kept. */
export function labelOf(meta: string, label: string): string {
  const title = /^title\t(.+)$/m.exec(meta)?.[1];
  return title ? title + (/ · @\S+$/.exec(label)?.[0] ?? '') : label;
}
