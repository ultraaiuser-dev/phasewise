import { HTMLAttributes, useEffect, useRef } from "react";
export function DropZone({
  onCardDrop,
  ...props
}: HTMLAttributes<HTMLDivElement> & { onCardDrop: (id: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    const handle = (e: Event) => {
      e.stopPropagation();
      onCardDrop((e as CustomEvent<{ cardId: string }>).detail.cardId);
    };
    el?.addEventListener("carddrop", handle);
    return () => el?.removeEventListener("carddrop", handle);
  }, [onCardDrop]);
  return <div {...props} ref={ref} data-drop="true" />;
}
