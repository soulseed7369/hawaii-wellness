import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const WebsitePreview = () => {
  const { listingId } = useParams<{ listingId: string }>();
  const [htmlContent, setHtmlContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPreview = async () => {
      if (!listingId) {
        setError("No listing ID provided");
        setLoading(false);
        return;
      }

      try {
        const publicUrl = `https://sccksxvjckllxlvyuotv.supabase.co/storage/v1/object/public/website-previews/${listingId}.html`;
        const response = await fetch(publicUrl);

        if (!response.ok) {
          if (response.status === 404) {
            setError("Website preview not found for this listing.");
          } else {
            setError("Failed to load website preview. Please try again.");
          }
          setLoading(false);
          return;
        }

        const html = await response.text();
        setHtmlContent(html);
        setError(null);
      } catch (err) {
        setError("Error loading website preview. Please try again later.");
        console.error("Preview fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchPreview();
  }, [listingId]);

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Sticky Banner */}
      <div className="sticky top-0 z-50 flex items-center justify-between bg-gradient-to-r from-teal-500 to-emerald-600 px-6 py-4 text-white shadow-lg">
        {/* Left: Branding */}
        <div className="text-sm font-medium">
          ✨ Preview built by Hawaiʻi Wellness
        </div>

        {/* Center: Call to action text */}
        <div className="hidden sm:block text-sm font-medium text-center flex-1 mx-4">
          Get this site for just $497 — Kamaʻāina Rate
        </div>

        {/* Right: CTAs */}
        <div className="flex gap-3">
          <a
            href="https://calendar.app.google/KYSWe4dXtc4rMTt1A"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-white text-teal-600 font-semibold rounded-md hover:bg-gray-100 transition text-sm whitespace-nowrap"
          >
            Book a Free Call
          </a>
          <Link
            to="/website-packages"
            className="px-4 py-2 bg-white bg-opacity-20 text-white font-semibold rounded-md hover:bg-opacity-30 transition text-sm whitespace-nowrap"
          >
            View Packages
          </Link>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden">
        {loading && (
          <div className="flex h-full items-center justify-center bg-gray-50">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-muted-foreground">Loading website preview...</p>
            </div>
          </div>
        )}

        {error && !loading && (
          <div className="flex h-full items-center justify-center bg-gray-50">
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-8 max-w-md text-center">
              <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <h3 className="font-semibold text-lg mb-2">Preview Not Available</h3>
              <p className="text-muted-foreground mb-6">{error}</p>
              <Button asChild>
                <Link to="/website-packages">Explore Website Packages</Link>
              </Button>
            </div>
          </div>
        )}

        {htmlContent && !loading && (
          <iframe
            srcDoc={htmlContent}
            className="w-full h-full border-0"
            title="Website Preview"
            sandbox="allow-scripts allow-same-origin"
          />
        )}
      </div>
    </div>
  );
};

export default WebsitePreview;
