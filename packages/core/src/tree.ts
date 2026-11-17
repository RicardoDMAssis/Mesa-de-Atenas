export interface TreeItem {
  id: string;
  parentId: string | null;
}

export interface TreeNode<T> {
  item: T;
  depth: number;
  children: TreeNode<T>[];
}

/**
 * Monta a árvore a partir da lista plana, preservando a ordem recebida entre irmãos.
 * Itens cujo pai não está na lista (ou que formariam um ciclo) sobem para a raiz,
 * para nunca desaparecerem da tela.
 */
export function buildTree<T extends TreeItem>(items: T[]): TreeNode<T>[] {
  const nodes = new Map(
    items.map((item) => [item.id, { item, depth: 0, children: [] } as TreeNode<T>]),
  );
  const reachesItself = (item: T) => {
    const seen = new Set([item.id]);
    for (let p = item.parentId; p; p = nodes.get(p)?.item.parentId ?? null) {
      if (seen.has(p)) return true;
      seen.add(p);
    }
    return false;
  };
  const roots: TreeNode<T>[] = [];
  for (const node of nodes.values()) {
    const parent = node.item.parentId ? nodes.get(node.item.parentId) : undefined;
    if (parent && !reachesItself(node.item)) parent.children.push(node);
    else roots.push(node);
  }
  const setDepth = (list: TreeNode<T>[], depth: number) => {
    for (const node of list) {
      node.depth = depth;
      setDepth(node.children, depth + 1);
    }
  };
  setDepth(roots, 0);
  return roots;
}

/** Árvore em lista, na ordem de exibição (pai seguido dos filhos). */
export function flattenTree<T>(roots: TreeNode<T>[]): TreeNode<T>[] {
  return roots.flatMap((node) => [node, ...flattenTree(node.children)]);
}
