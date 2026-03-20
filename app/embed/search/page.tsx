import Search from "./components/Search";

export const metadata = {
  title: "Search Embed",
  robots: { index: false, follow: false },
};

export default function EmbedSearchPage() {
  return (
    <div style={{ padding: 16, maxWidth: 900, margin: "0 auto" }}>
      <Search />
    </div>
  );
}
