import { useEffect, useState } from "react";
import { Plus, Radar, Save } from "lucide-react";
import { api, Recommendation, Restaurant, UserProfile } from "./api/client";
import { ChipInput } from "./components/ChipInput";
import { RecommendationCard } from "./components/RecommendationCard";

const cuisines = ["Italian", "Mexican", "Thai", "Indian", "American", "Japanese", "Mediterranean"];
const tags = ["date-night", "casual", "outdoor-seating", "brunch", "cocktails", "quiet", "upscale", "quick-bite", "good-parking", "worth-the-drive"];
const prices = ["$", "$$", "$$$", "$$$$"];

export function App() {
  const [profile, setProfile] = useState<UserProfile>();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [request, setRequest] = useState({ area: "Reston", occasion: "date-night", priceLevels: ["$$", "$$$"], newOnly: true, includeWantToTry: true });
  const [newRestaurant, setNewRestaurant] = useState({ name: "", area: "Reston", cuisineCategories: ["Thai"], priceLevel: "$$", tags: ["date-night"] });
  const [visitRestaurantId, setVisitRestaurantId] = useState("");
  const [status, setStatus] = useState<{ tone: "success" | "error" | "info"; message: string }>();
  const [busyAction, setBusyAction] = useState<"add" | "recommend" | "profile" | "visit">();

  useEffect(() => {
    api.getProfile().then((next) => {
      setProfile(next);
      setRequest((current) => ({ ...current, area: next.homeArea || current.area, priceLevels: next.preferredPriceLevels.length ? next.preferredPriceLevels : current.priceLevels }));
    });
    refreshRestaurants();
  }, []);

  async function refreshRestaurants() {
    try {
      setRestaurants(await api.listRestaurants());
    } catch (error) {
      setStatus({ tone: "error", message: messageFromError(error) });
    }
  }

  async function pickThree() {
    setBusyAction("recommend");
    setStatus(undefined);
    try {
      const result = await api.recommendations(request);
      setRecommendations(result.recommendations);
      setStatus({
        tone: result.recommendations.length ? "success" : "info",
        message: result.recommendations.length
          ? `Found ${result.recommendations.length} recommendation${result.recommendations.length === 1 ? "" : "s"} for ${request.area}.`
          : `No matches yet for ${request.area}. Add a restaurant in that area or broaden the filters.`
      });
    } catch (error) {
      setStatus({ tone: "error", message: messageFromError(error) });
    } finally {
      setBusyAction(undefined);
    }
  }

  async function saveProfile() {
    if (!profile) return;
    setBusyAction("profile");
    setStatus(undefined);
    try {
      setProfile(await api.putProfile(profile));
      setStatus({ tone: "success", message: "Preferences saved." });
    } catch (error) {
      setStatus({ tone: "error", message: messageFromError(error) });
    } finally {
      setBusyAction(undefined);
    }
  }

  async function addRestaurant() {
    if (!newRestaurant.name.trim()) {
      setStatus({ tone: "error", message: "Enter a restaurant name before adding it." });
      return;
    }
    setBusyAction("add");
    setStatus(undefined);
    try {
      const created = await api.createRestaurant(newRestaurant);
      setNewRestaurant({ ...newRestaurant, name: "" });
      setRequest((current) => ({ ...current, area: created.area }));
      await refreshRestaurants();
      setStatus({ tone: "success", message: `Added ${created.name} in ${created.area}.` });
    } catch (error) {
      setStatus({ tone: "error", message: messageFromError(error) });
    } finally {
      setBusyAction(undefined);
    }
  }

  async function markVisited(restaurantId: string) {
    setBusyAction("visit");
    setStatus(undefined);
    try {
      await api.createVisit({ restaurantId, occasion: request.occasion, rating: "liked", wouldReturn: true, tags: [request.occasion], notes: "" });
      const restaurant = restaurants.find((item) => item.restaurantId === restaurantId);
      setVisitRestaurantId("");
      setStatus({ tone: "success", message: restaurant ? `Marked ${restaurant.name} as visited.` : "Marked restaurant as visited." });
    } catch (error) {
      setStatus({ tone: "error", message: messageFromError(error) });
    } finally {
      setBusyAction(undefined);
    }
  }

  return (
    <main>
      <section className="hero">
        <div>
          <div className="brand"><Radar size={24} /> Date Night Radar</div>
          <h1>Where should we go tonight?</h1>
        </div>
        <div className="quick-panel">
          <label className="field">
            <span>Area</span>
            <input value={request.area} onChange={(event) => setRequest({ ...request, area: event.target.value })} />
          </label>
          <label className="field">
            <span>Occasion</span>
            <select value={request.occasion} onChange={(event) => setRequest({ ...request, occasion: event.target.value })}>
              {tags.map((tag) => <option key={tag}>{tag}</option>)}
            </select>
          </label>
          <ChipInput label="Price" options={prices} value={request.priceLevels} onChange={(priceLevels) => setRequest({ ...request, priceLevels })} />
          <label className="toggle"><input type="checkbox" checked={request.newOnly} onChange={(event) => setRequest({ ...request, newOnly: event.target.checked })} /> New places only</label>
          <label className="toggle"><input type="checkbox" checked={request.includeWantToTry} onChange={(event) => setRequest({ ...request, includeWantToTry: event.target.checked })} /> Include Want to Try</label>
          <button className="primary" disabled={busyAction === "recommend"} onClick={pickThree}><Radar size={18} /> {busyAction === "recommend" ? "Picking..." : "Pick 3 for us"}</button>
        </div>
      </section>

      {status && <div className={`status ${status.tone}`} role="status">{status.message}</div>}

      <section className="recommendations">
        {recommendations.map((recommendation) => (
          <RecommendationCard
            key={recommendation.category}
            recommendation={recommendation}
            onWantToTry={(id) => api.saveWantToTry(id)}
            onVisited={markVisited}
            onArchive={(id) => api.archive(id)}
          />
        ))}
      </section>

      <section className="workspace-grid">
        <div className="panel">
          <h2>Add Restaurant</h2>
          <label className="field"><span>Name</span><input value={newRestaurant.name} onChange={(event) => setNewRestaurant({ ...newRestaurant, name: event.target.value })} /></label>
          <label className="field"><span>Area</span><input value={newRestaurant.area} onChange={(event) => setNewRestaurant({ ...newRestaurant, area: event.target.value })} /></label>
          <ChipInput label="Cuisine" options={cuisines} value={newRestaurant.cuisineCategories} onChange={(cuisineCategories) => setNewRestaurant({ ...newRestaurant, cuisineCategories })} />
          <ChipInput label="Tags" options={tags} value={newRestaurant.tags} onChange={(nextTags) => setNewRestaurant({ ...newRestaurant, tags: nextTags })} />
          <button className="primary" disabled={busyAction === "add"} onClick={addRestaurant}><Plus size={18} /> {busyAction === "add" ? "Adding..." : "Add"}</button>
        </div>

        <div className="panel">
          <h2>Visit Rating</h2>
          <label className="field">
            <span>Restaurant</span>
            <select value={visitRestaurantId} onChange={(event) => setVisitRestaurantId(event.target.value)}>
              <option value="">Choose a restaurant</option>
              {restaurants.map((restaurant) => <option value={restaurant.restaurantId} key={restaurant.restaurantId}>{restaurant.name}</option>)}
            </select>
          </label>
          <button className="primary" disabled={!visitRestaurantId || busyAction === "visit"} onClick={() => markVisited(visitRestaurantId)}><Save size={18} /> {busyAction === "visit" ? "Saving..." : "Would go back"}</button>
        </div>

        <div className="panel restaurant-list">
          <h2>Saved Restaurants</h2>
          {restaurants.length ? (
            <div className="saved-list">
              {restaurants.slice(0, 8).map((restaurant) => (
                <div className="saved-restaurant" key={restaurant.restaurantId}>
                  <strong>{restaurant.name}</strong>
                  <span>{restaurant.area} · {restaurant.cuisineCategories.join(", ") || "Unknown"} · {restaurant.priceLevel}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="empty">No restaurants saved yet.</p>
          )}
        </div>

        {profile && (
          <div className="panel profile-panel">
            <h2>Preferences</h2>
            <label className="field"><span>Name</span><input value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} /></label>
            <label className="field"><span>Home area</span><input value={profile.homeArea} onChange={(event) => setProfile({ ...profile, homeArea: event.target.value })} /></label>
            <ChipInput label="Favorite cuisines" options={cuisines} value={profile.favoriteCuisines} onChange={(favoriteCuisines) => setProfile({ ...profile, favoriteCuisines })} />
            <ChipInput label="Preferred tags" options={tags} value={profile.preferredTags} onChange={(preferredTags) => setProfile({ ...profile, preferredTags })} />
            <ChipInput label="Price levels" options={prices} value={profile.preferredPriceLevels} onChange={(preferredPriceLevels) => setProfile({ ...profile, preferredPriceLevels })} />
            <button className="primary" disabled={busyAction === "profile"} onClick={saveProfile}><Save size={18} /> {busyAction === "profile" ? "Saving..." : "Save"}</button>
          </div>
        )}
      </section>
    </main>
  );
}

function messageFromError(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong.";
}
