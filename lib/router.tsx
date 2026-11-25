import * as React from "react";

interface RouterContextValue {
  pathname: string;
  search: string;
  navigate: (to: string, options?: { replace?: boolean; scroll?: boolean }) => void;
}

const RouterContext = React.createContext<RouterContextValue | null>(null);

function splitTarget(to: string): { pathname: string; search: string } {
  const qIdx = to.indexOf("?");
  if (qIdx === -1) {
    return { pathname: to || "/", search: "" };
  }
  return {
    pathname: to.slice(0, qIdx) || "/",
    search: to.slice(qIdx),
  };
}

export function RouterProvider({ children }: { children: React.ReactNode }) {
  const [locationState, setLocationState] = React.useState(() => ({
    pathname: typeof window !== "undefined" ? window.location.pathname || "/" : "/",
    search: typeof window !== "undefined" ? window.location.search : "",
  }));

  React.useEffect(() => {
    const onPopState = () => {
      setLocationState({
        pathname: window.location.pathname || "/",
        search: window.location.search,
      });
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const navigate = React.useCallback(
    (to: string, options?: { replace?: boolean; scroll?: boolean }) => {
      const next = splitTarget(to);
      const url = `${next.pathname}${next.search}`;
      if (options?.replace) {
        window.history.replaceState(null, "", url);
      } else {
        window.history.pushState(null, "", url);
      }
      setLocationState(next);
      if (options?.scroll !== false) {
        window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
      }
    },
    [],
  );

  const value = React.useMemo(
    () => ({
      pathname: locationState.pathname,
      search: locationState.search,
      navigate,
    }),
    [locationState.pathname, locationState.search, navigate],
  );

  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

export function useRouter(): RouterContextValue {
  const ctx = React.useContext(RouterContext);
  if (!ctx) {
    throw new Error("useRouter must be used inside RouterProvider");
  }
  return ctx;
}

export function Link({
  to,
  onClick,
  children,
  ...props
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) {
  const { navigate } = useRouter();

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (
      e.defaultPrevented ||
      e.metaKey ||
      e.ctrlKey ||
      e.shiftKey ||
      e.altKey ||
      e.button !== 0
    ) {
      return;
    }
    e.preventDefault();
    navigate(to);
  };

  return (
    <a href={to} onClick={handleClick} {...props}>
      {children}
    </a>
  );
}
