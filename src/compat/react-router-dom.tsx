"use client";

import NextLink from "next/link";
import type { ReactNode } from "react";

type Props = {
  to: string;
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
};

export function Link({ to, children, ...rest }: Props) {
  return (
    <NextLink href={to} {...rest}>
      {children}
    </NextLink>
  );
}