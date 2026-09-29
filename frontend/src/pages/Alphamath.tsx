import { useEffect } from "react";

export default function Alphamath() {
  useEffect(() => {
    window.location.replace("/alphamath-app/");
  }, []);

  return null;
}
