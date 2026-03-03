import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, MapPin } from "lucide-react";
import { useNavigate } from "react-router-dom";
import heroImage from "@/assets/hero-homepage.jpg";

const ISLAND_OPTIONS = [
  { value: 'all', label: 'All Islands' },
  { value: 'big_island', label: 'Big Island' },
  { value: 'oahu', label: "Oʻahu" },
  { value: 'maui', label: 'Maui' },
  { value: 'kauai', label: "Kauaʻi" },
];

interface SearchBarProps {
  island?: string;
  heroImageUrl?: string;
  heroTitle?: string;
  heroSubtitle?: string;
}

export function SearchBar({
  island: initialIsland = 'big_island',
  heroImageUrl,
  heroTitle = "Find Your Path to Wellness",
  heroSubtitle = "Discover holistic practitioners, retreats & wellness centers across Hawai'i",
}: SearchBarProps = {}) {
  const navigate = useNavigate();
  const [what, setWhat] = useState('');
  const [where, setWhere] = useState('');
  const [island, setIsland] = useState(initialIsland);

  const handleSearch = () => {
    const params = new URLSearchParams();
    if (what.trim()) params.set('q', what.trim());
    if (where.trim()) params.set('location', where.trim());
    if (island && island !== 'all') params.set('island', island);
    navigate(`/directory?${params.toString()}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  const bgImage = heroImageUrl || heroImage;

  return (
    <section className="relative overflow-hidden py-24 md:py-32">
      <img
        src={bgImage}
        alt="Hawaii wellness"
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-foreground/40" />
      <div className="container relative z-10">
        <h1 className="mb-2 text-center font-display text-3xl font-bold text-primary-foreground md:text-5xl">
          {heroTitle}
        </h1>
        <p className="mb-8 text-center text-lg text-primary-foreground/85">
          {heroSubtitle}
        </p>
        <div className="mx-auto flex max-w-3xl flex-col gap-3 rounded-xl bg-background/70 p-4 shadow-lg backdrop-blur-md sm:flex-row sm:items-center">
          {/* What */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="What? (e.g., Massage, Reiki, Naturopath)"
              className="border-0 bg-transparent pl-10 shadow-none focus-visible:ring-0"
              value={what}
              onChange={e => setWhat(e.target.value)}
              onKeyDown={handleKeyDown}
            />
          </div>
          <div className="hidden h-8 w-px bg-border sm:block" />
          {/* Where */}
          <div className="relative flex-1">
            <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Where? (e.g., Kona, Hilo, Haiku)"
              className="border-0 bg-transparent pl-10 shadow-none focus-visible:ring-0"
              value={where}
              onChange={e => setWhere(e.target.value)}
              onKeyDown={handleKeyDown}
            />
          </div>
          <div className="hidden h-8 w-px bg-border sm:block" />
          {/* Island selector */}
          <Select value={island} onValueChange={setIsland}>
            <SelectTrigger className="border-0 bg-transparent shadow-none focus:ring-0 w-36 flex-shrink-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ISLAND_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button className="sm:px-8 flex-shrink-0" onClick={handleSearch}>Search</Button>
        </div>
      </div>
    </section>
  );
}
