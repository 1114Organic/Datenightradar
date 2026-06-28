import { useEffect, useState } from "react";
import { Download, KeyRound, LogIn, LogOut, Pencil, Plus, Radar, Save, ShieldCheck, Trash2, UserCircle, X } from "lucide-react";
import { api, configureApi, Recommendation, Restaurant, RestaurantImportTarget, UserProfile, UserRestaurantState, Visit } from "./api/client";
import { ChipInput } from "./components/ChipInput";
import { RecommendationCard } from "./components/RecommendationCard";
import { AuthSession, beginHostedAuth, clearStoredSession, completeHostedAuth, loadRuntimeConfig, RuntimeConfig, signOut } from "./auth/cognito";

const cuisines = ["Italian", "Mexican", "Thai", "Indian", "American", "Japanese", "Mediterranean"];
const tags = ["date-night", "casual", "outdoor-seating", "brunch", "cocktails", "quiet", "upscale", "quick-bite", "good-parking", "worth-the-drive"];
const prices = ["$", "$$", "$$$", "$$$$"];
const defaultArea = "Charleston, SC";
const defaultImportTargets: RestaurantImportTarget[] = [
  { type: "city", value: "Charleston, SC" },
  { type: "city", value: "North Charleston, SC" },
  { type: "city", value: "Mount Pleasant, SC" },
  { type: "city", value: "James Island, SC" },
  { type: "city", value: "Johns Island, SC" }
];

export function App() {
  const [profile, setProfile] = useState<UserProfile>();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [request, setRequest] = useState({ area: defaultArea, occasion: "date-night", priceLevels: ["$$", "$$$"], newOnly: true, includeWantToTry: true });
  const [newRestaurant, setNewRestaurant] = useState({ name: "", city: "Charleston", state: "SC", zipCode: "", cuisineCategories: ["Thai"], priceLevel: "$$", tags: ["date-night"] });
  const [visitRestaurantId, setVisitRestaurantId] = useState("");
  const [status, setStatus] = useState<{ tone: "success" | "error" | "info"; message: string }>();
  const [busyAction, setBusyAction] = useState<"add" | "recommend" | "profile" | "visit" | "import">();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [showRestaurantEditor, setShowRestaurantEditor] = useState(false);
  const [adminSearch, setAdminSearch] = useState("");
  const [editingRestaurants, setEditingRestaurants] = useState<Record<string, Partial<Restaurant>>>({});
  const [confirmDeleteRestaurantId, setConfirmDeleteRestaurantId] = useState<string>();
  const [importTargets, setImportTargets] = useState<RestaurantImportTarget[]>(defaultImportTargets);
  const [newImportTarget, setNewImportTarget] = useState<RestaurantImportTarget>({ type: "zip", value: "" });
  const [runtimeConfig, setRuntimeConfig] = useState<RuntimeConfig>();
  const [authSession, setAuthSession] = useState<AuthSession>();
  const [authReady, setAuthReady] = useState(false);
  const [userRestaurantStates, setUserRestaurantStates] = useState<UserRestaurantState[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);

  useEffect(() => {
    async function start() {
      try {
        const config = await loadRuntimeConfig();
        setRuntimeConfig(config);
        configureApi({ apiBaseUrl: config.apiBaseUrl });
        const session = config.authMode === "cognito" ? await completeHostedAuth(config) : undefined;
        setAuthSession(session);
        configureApi({ apiBaseUrl: config.apiBaseUrl, authToken: session?.idToken });
        setAuthReady(true);
        if (config.authMode === "dev" || session) await loadAppData(session);
      } catch (error) {
        clearStoredSession();
        setAuthReady(true);
        setStatus({ tone: "error", message: messageFromError(error) });
      }
    }
    start();
  }, []);

  async function loadAppData(session?: AuthSession) {
    const [nextProfile, nextRestaurants, nextStates, nextVisits] = await Promise.all([
      api.getProfile(),
      api.listRestaurants(),
      api.listUserRestaurants(),
      api.listVisits()
    ]);
    const nextProfileWithDefaults = applyProfileDefaults(nextProfile, session);
    setProfile(nextProfileWithDefaults);
    setRestaurants(nextRestaurants);
    setUserRestaurantStates(nextStates);
    setVisits(nextVisits);
    setRequest((current) => ({
      ...current,
      area: nextProfileWithDefaults.homeArea || current.area,
      priceLevels: nextProfileWithDefaults.preferredPriceLevels.length ? nextProfileWithDefaults.preferredPriceLevels : current.priceLevels
    }));
  }

  async function refreshRestaurants() {
    try {
      setRestaurants(await api.listRestaurants());
      setUserRestaurantStates(await api.listUserRestaurants());
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
      const name = [profile.firstName, profile.lastName].filter(Boolean).join(" ") || profile.name;
      setProfile(await api.putProfile({ ...profile, name }));
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
      const created = await api.createRestaurant({
        ...newRestaurant,
        area: formatRestaurantArea(newRestaurant.city, newRestaurant.state)
      });
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
      setUserRestaurantStates(await api.listUserRestaurants());
      setVisits(await api.listVisits());
      setStatus({ tone: "success", message: restaurant ? `Marked ${restaurant.name} as visited.` : "Marked restaurant as visited." });
    } catch (error) {
      setStatus({ tone: "error", message: messageFromError(error) });
    } finally {
      setBusyAction(undefined);
    }
  }

  async function saveWantToTry(restaurantId: string) {
    try {
      await api.saveWantToTry(restaurantId);
      setUserRestaurantStates(await api.listUserRestaurants());
      setStatus({ tone: "success", message: "Saved to Want to Try." });
    } catch (error) {
      setStatus({ tone: "error", message: messageFromError(error) });
    }
  }

  async function saveRestaurantEdit(restaurantId: string) {
    const current = editingRestaurants[restaurantId];
    if (!current) return;
    setBusyAction("add");
    setStatus(undefined);
    try {
      const updated = await api.updateRestaurant(restaurantId, {
        ...current,
        area: formatRestaurantArea(current.city ?? "", current.state ?? "")
      });
      setRestaurants((items) => items.map((restaurant) => restaurant.restaurantId === restaurantId ? updated : restaurant));
      setEditingRestaurants(({ [restaurantId]: _saved, ...rest }) => rest);
      setStatus({ tone: "success", message: `Updated ${updated.name}.` });
    } catch (error) {
      setStatus({ tone: "error", message: messageFromError(error) });
    } finally {
      setBusyAction(undefined);
    }
  }

  async function deleteRestaurant(restaurantId: string) {
    const restaurant = restaurants.find((item) => item.restaurantId === restaurantId);
    if (!restaurant) return;
    if (confirmDeleteRestaurantId !== restaurantId) {
      setConfirmDeleteRestaurantId(restaurantId);
      setStatus({ tone: "info", message: `Click Delete again to remove ${restaurant.name}.` });
      return;
    }
    setBusyAction("add");
    setStatus(undefined);
    try {
      await api.deleteRestaurant(restaurantId);
      setRestaurants((items) => items.filter((item) => item.restaurantId !== restaurantId));
      setEditingRestaurants(({ [restaurantId]: _deleted, ...rest }) => rest);
      setConfirmDeleteRestaurantId(undefined);
      setStatus({ tone: "success", message: `Deleted ${restaurant.name}.` });
    } catch (error) {
      setStatus({ tone: "error", message: messageFromError(error) });
    } finally {
      setBusyAction(undefined);
    }
  }

  async function importAreaRestaurants() {
    setBusyAction("import");
    setStatus(undefined);
    try {
      const result = await api.importRestaurants(importTargets);
      await refreshRestaurants();
      setStatus({
        tone: "success",
        message: `Imported ${result.importedCount} restaurant${result.importedCount === 1 ? "" : "s"} and skipped ${result.skippedCount} existing entr${result.skippedCount === 1 ? "y" : "ies"}.`
      });
    } catch (error) {
      setStatus({ tone: "error", message: messageFromError(error) });
    } finally {
      setBusyAction(undefined);
    }
  }

  function addImportTarget() {
    if (!newImportTarget.value.trim()) return;
    setImportTargets((current) => [...current, { ...newImportTarget, value: newImportTarget.value.trim() }]);
    setNewImportTarget({ ...newImportTarget, value: "" });
  }

  const filteredAdminRestaurants = restaurants.filter((restaurant) => {
    const query = adminSearch.trim().toLowerCase();
    if (!query) return true;
    return [
      restaurant.name,
      restaurant.area,
      restaurant.city,
      restaurant.state,
      restaurant.zipCode,
      restaurant.cuisineCategories.join(" "),
      restaurant.tags.join(" "),
      restaurant.priceLevel
    ].filter(Boolean).some((value) => String(value).toLowerCase().includes(query));
  });

  const isSignedIn = runtimeConfig?.authMode !== "cognito" || Boolean(authSession);
  const isAdmin = runtimeConfig?.authMode === "dev" || authSession?.groups.includes("Admin");
  const displayName = profile?.firstName || profile?.name || authSession?.email || "Profile";
  const restaurantById = new Map(restaurants.map((restaurant) => [restaurant.restaurantId, restaurant]));
  const visitCountByRestaurantId = visits.reduce<Record<string, number>>((counts, visit) => ({
    ...counts,
    [visit.restaurantId]: (counts[visit.restaurantId] ?? 0) + 1
  }), {});
  const heartedRestaurants = userRestaurantStates.filter((state) => state.status === "want_to_try").map((state) => restaurantById.get(state.restaurantId)).filter(Boolean) as Restaurant[];
  const visitedRestaurants = userRestaurantStates.filter((state) => state.status === "visited").map((state) => restaurantById.get(state.restaurantId)).filter(Boolean) as Restaurant[];

  return (
    <main>
      <section className="hero">
        <div>
          <div className="brand"><Radar size={24} /> Date Night Radar</div>
          <h1>Where should we go tonight?</h1>
        </div>
        <div className="profile-menu">
          {runtimeConfig?.authMode === "cognito" && !authSession ? (
            <div className="auth-buttons">
              <button type="button" className="profile-button" disabled={!authReady} onClick={() => runtimeConfig && beginHostedAuth(runtimeConfig, "login")}>
                <LogIn size={20} />
                <span>Login</span>
              </button>
              <button type="button" className="profile-button" disabled={!authReady} onClick={() => runtimeConfig && beginHostedAuth(runtimeConfig, "signup")}>
                <UserCircle size={20} />
                <span>Sign up</span>
              </button>
            </div>
          ) : (
            <>
              <button
                type="button"
                className="profile-button"
                aria-haspopup="menu"
                aria-expanded={showProfileMenu}
                onClick={() => setShowProfileMenu((current) => !current)}
              >
                <UserCircle size={22} />
                <span>{displayName}</span>
              </button>
              {showProfileMenu && (
                <div className="profile-menu-popover" role="menu">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setShowProfileModal(true);
                      setShowProfileMenu(false);
                    }}
                  >
                    Profile
                  </button>
                  {isAdmin && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setShowAdminPanel(true);
                        setShowProfileModal(false);
                        setShowProfileMenu(false);
                      }}
                    >
                      Admin Panel
                    </button>
                  )}
                  {runtimeConfig?.authMode === "cognito" && (
                    <>
                      <button type="button" role="menuitem" onClick={() => runtimeConfig && beginHostedAuth(runtimeConfig, "reset")}>
                        <KeyRound size={16} />
                        Reset Password
                      </button>
                      <button type="button" role="menuitem" onClick={() => runtimeConfig && signOut(runtimeConfig)}>
                        <LogOut size={16} />
                        Logout
                      </button>
                    </>
                  )}
                </div>
              )}
            </>
          )}
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

      {!isSignedIn && authReady && runtimeConfig && (
        <section className="auth-gate">
          <h2>Date night starts with your profile.</h2>
          <p>Sign in or create an account to save preferences, heart restaurants, and track visits.</p>
          <div className="auth-buttons">
            <button type="button" className="primary" onClick={() => beginHostedAuth(runtimeConfig, "login")}><LogIn size={18} /> Login</button>
            <button type="button" className="secondary-action" onClick={() => beginHostedAuth(runtimeConfig, "signup")}><UserCircle size={18} /> Sign up</button>
          </div>
        </section>
      )}

      {isSignedIn && (
      <>
      <section className="recommendations">
        {recommendations.map((recommendation) => (
          <RecommendationCard
            key={recommendation.category}
            recommendation={recommendation}
            onWantToTry={saveWantToTry}
            onVisited={markVisited}
            onArchive={(id) => api.archive(id)}
          />
        ))}
      </section>

      {profile && showProfileModal && (
        <div className="modal-backdrop" role="presentation">
          <section className="profile-modal" role="dialog" aria-modal="true" aria-label="Profile">
            <div className="panel-heading">
              <div className="panel-title">
                <UserCircle size={24} />
                <h2>Profile</h2>
              </div>
              <button type="button" className="icon-button" aria-label="Close profile" onClick={() => setShowProfileModal(false)}><X size={20} /></button>
            </div>
            <div className="profile-form-grid">
              <label className="field"><span>First name</span><input value={profile.firstName ?? firstNameFrom(profile.name)} onChange={(event) => setProfile({ ...profile, firstName: event.target.value })} /></label>
              <label className="field"><span>Last name</span><input value={profile.lastName ?? lastNameFrom(profile.name)} onChange={(event) => setProfile({ ...profile, lastName: event.target.value })} /></label>
              <label className="field full"><span>Email address</span><input value={profile.email ?? authSession?.email ?? ""} onChange={(event) => setProfile({ ...profile, email: event.target.value })} /></label>
            </div>
            <div className="profile-section">
              <h3>Preferences</h3>
              <label className="field"><span>Home area</span><input value={profile.homeArea} onChange={(event) => setProfile({ ...profile, homeArea: event.target.value })} /></label>
              <ChipInput label="Favorite cuisines" options={cuisines} value={profile.favoriteCuisines} onChange={(favoriteCuisines) => setProfile({ ...profile, favoriteCuisines })} />
              <ChipInput label="Preferred tags" options={tags} value={profile.preferredTags} onChange={(preferredTags) => setProfile({ ...profile, preferredTags })} />
              <ChipInput label="Price levels" options={prices} value={profile.preferredPriceLevels} onChange={(preferredPriceLevels) => setProfile({ ...profile, preferredPriceLevels })} />
              <button className="primary" disabled={busyAction === "profile"} onClick={saveProfile}><Save size={18} /> {busyAction === "profile" ? "Saving..." : "Save Profile"}</button>
            </div>
            <div className="profile-lists">
              <section className="profile-section">
                <h3>Visited Restaurants</h3>
                {visitedRestaurants.length ? visitedRestaurants.map((restaurant) => (
                  <div className="saved-restaurant" key={restaurant.restaurantId}>
                    <strong>{restaurant.name}</strong>
                    <span>{displayRestaurantLocation(restaurant)} | {restaurant.cuisineCategories.join(", ") || "Unknown"} | {restaurant.priceLevel} | {visitCountByRestaurantId[restaurant.restaurantId] ?? 1} visit{(visitCountByRestaurantId[restaurant.restaurantId] ?? 1) === 1 ? "" : "s"}</span>
                  </div>
                )) : <p className="empty">No visited restaurants yet.</p>}
              </section>
              <section className="profile-section">
                <h3>Hearted Restaurants</h3>
                {heartedRestaurants.length ? heartedRestaurants.map((restaurant) => (
                  <div className="saved-restaurant" key={restaurant.restaurantId}>
                    <strong>{restaurant.name}</strong>
                    <span>{displayRestaurantLocation(restaurant)} | {restaurant.cuisineCategories.join(", ") || "Unknown"} | {restaurant.priceLevel}</span>
                  </div>
                )) : <p className="empty">No hearted restaurants yet.</p>}
              </section>
            </div>
          </section>
        </div>
      )}

      <section className="workspace-grid">
        <div className="panel">
          <h2>Add Restaurant</h2>
          <label className="field"><span>Name</span><input value={newRestaurant.name} onChange={(event) => setNewRestaurant({ ...newRestaurant, name: event.target.value })} /></label>
          <div className="location-grid">
            <label className="field"><span>City</span><input value={newRestaurant.city} onChange={(event) => setNewRestaurant({ ...newRestaurant, city: event.target.value })} /></label>
            <label className="field"><span>State</span><input value={newRestaurant.state} maxLength={2} onChange={(event) => setNewRestaurant({ ...newRestaurant, state: event.target.value.toUpperCase() })} /></label>
            <label className="field"><span>ZIP</span><input value={newRestaurant.zipCode} inputMode="numeric" onChange={(event) => setNewRestaurant({ ...newRestaurant, zipCode: event.target.value })} /></label>
          </div>
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

        {isAdmin && showAdminPanel && (
          <div className="panel admin-panel">
            <div className="panel-heading">
              <div className="panel-title">
                <ShieldCheck size={22} />
                <h2>Admin Panel</h2>
              </div>
              <button type="button" className="text-link" onClick={() => setShowAdminPanel(false)}>Close</button>
            </div>
            <button type="button" className="secondary-action" onClick={() => setShowRestaurantEditor((current) => !current)}>
              <Pencil size={18} />
              {showRestaurantEditor ? "Hide Edit Restaurants" : "Edit Restaurants"}
            </button>
            <section className="admin-import" aria-label="Restaurant import">
              <div className="panel-heading">
                <div>
                  <h3>Area Restaurant Import</h3>
                  <p className="muted">Seed Charleston County restaurants now; the same targets run weekly in AWS.</p>
                </div>
                <button type="button" className="secondary-action" disabled={busyAction === "import" || !importTargets.length} onClick={importAreaRestaurants}>
                  <Download size={18} />
                  {busyAction === "import" ? "Pulling..." : "Pull Restaurants"}
                </button>
              </div>
              <div className="import-targets" aria-label="Import targets">
                {importTargets.map((target, index) => (
                  <span className="target-pill" key={`${target.type}-${target.value}`}>
                    {target.type}: {target.value}
                    <button type="button" aria-label={`Remove ${target.value}`} onClick={() => setImportTargets((current) => current.filter((_, itemIndex) => itemIndex !== index))}>x</button>
                  </span>
                ))}
              </div>
              <div className="import-target-form">
                <label className="field">
                  <span>Target type</span>
                  <select value={newImportTarget.type} onChange={(event) => setNewImportTarget({ ...newImportTarget, type: event.target.value })}>
                    <option value="city">City</option>
                    <option value="county">County</option>
                    <option value="zip">ZIP</option>
                  </select>
                </label>
                <label className="field">
                  <span>County, city, or ZIP</span>
                  <input value={newImportTarget.value} onChange={(event) => setNewImportTarget({ ...newImportTarget, value: event.target.value })} placeholder="Charleston County, SC or 29412" />
                </label>
                <button type="button" className="secondary-action" onClick={addImportTarget}>
                  <Plus size={18} />
                  Add Target
                </button>
              </div>
            </section>
            {showRestaurantEditor && (
              <section className="admin-editor" aria-label="Edit restaurants">
                <label className="field">
                  <span>Search inventory</span>
                  <input value={adminSearch} onChange={(event) => setAdminSearch(event.target.value)} />
                </label>
                <div className="admin-table" role="table" aria-label="Restaurant inventory">
                  <div className="admin-row admin-header" role="row">
                    <span>Name</span>
                    <span>City</span>
                    <span>State</span>
                    <span>ZIP</span>
                    <span>Cuisine</span>
                    <span>Tags</span>
                    <span>Price</span>
                    <span>Actions</span>
                  </div>
                  {filteredAdminRestaurants.map((restaurant) => {
                    const draft = editingRestaurants[restaurant.restaurantId] ?? restaurant;
                    return (
                      <div className="admin-row" role="row" key={restaurant.restaurantId}>
                        <input aria-label={`${restaurant.name} name`} value={draft.name ?? ""} onChange={(event) => setRestaurantDraft(restaurant.restaurantId, { name: event.target.value })} />
                        <input aria-label={`${restaurant.name} city`} value={draft.city ?? ""} onChange={(event) => setRestaurantDraft(restaurant.restaurantId, { city: event.target.value })} />
                        <input aria-label={`${restaurant.name} state`} maxLength={2} value={draft.state ?? ""} onChange={(event) => setRestaurantDraft(restaurant.restaurantId, { state: event.target.value.toUpperCase() })} />
                        <input aria-label={`${restaurant.name} ZIP`} inputMode="numeric" value={draft.zipCode ?? ""} onChange={(event) => setRestaurantDraft(restaurant.restaurantId, { zipCode: event.target.value })} />
                        <input aria-label={`${restaurant.name} cuisines`} value={(draft.cuisineCategories ?? []).join(", ")} onChange={(event) => setRestaurantDraft(restaurant.restaurantId, { cuisineCategories: splitCsv(event.target.value) })} />
                        <input aria-label={`${restaurant.name} tags`} value={(draft.tags ?? []).join(", ")} onChange={(event) => setRestaurantDraft(restaurant.restaurantId, { tags: splitCsv(event.target.value) })} />
                        <select aria-label={`${restaurant.name} price`} value={draft.priceLevel ?? "$$"} onChange={(event) => setRestaurantDraft(restaurant.restaurantId, { priceLevel: event.target.value })}>
                          {prices.map((price) => <option key={price}>{price}</option>)}
                        </select>
                        <div className="admin-actions">
                          <button className="secondary-action compact-action" disabled={!editingRestaurants[restaurant.restaurantId] || busyAction === "add"} onClick={() => saveRestaurantEdit(restaurant.restaurantId)}>Save</button>
                          <button
                            className={`secondary-action compact-action danger-action${confirmDeleteRestaurantId === restaurant.restaurantId ? " confirming" : ""}`}
                            disabled={busyAction === "add"}
                            onClick={() => deleteRestaurant(restaurant.restaurantId)}
                            aria-label={`${confirmDeleteRestaurantId === restaurant.restaurantId ? "Confirm delete" : "Delete"} ${restaurant.name}`}
                          >
                            <Trash2 size={16} />
                            {confirmDeleteRestaurantId === restaurant.restaurantId ? "Confirm" : "Delete"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {!filteredAdminRestaurants.length && <p className="empty">No restaurants match that search.</p>}
              </section>
            )}
          </div>
        )}
      </section>
      </>
      )}
    </main>
  );

  function setRestaurantDraft(restaurantId: string, patch: Partial<Restaurant>) {
    const restaurant = restaurants.find((item) => item.restaurantId === restaurantId);
    if (!restaurant) return;
    setEditingRestaurants((current) => ({
      ...current,
      [restaurantId]: { ...restaurant, ...current[restaurantId], ...patch }
    }));
  }
}

function messageFromError(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong.";
}

function formatRestaurantArea(city: string, state: string) {
  const cleanedCity = city.trim();
  const cleanedState = state.trim().toUpperCase();
  return [cleanedCity, cleanedState].filter(Boolean).join(", ");
}

function displayRestaurantLocation(restaurant: Restaurant) {
  const cityState = formatRestaurantArea(restaurant.city ?? "", restaurant.state ?? "");
  return [cityState || restaurant.area, restaurant.zipCode].filter(Boolean).join(" ");
}

function applyProfileDefaults(profile: UserProfile, session?: AuthSession): UserProfile {
  const nextProfile = profile.homeArea === "Reston" ? { ...profile, homeArea: defaultArea } : profile;
  return {
    ...nextProfile,
    firstName: nextProfile.firstName ?? session?.firstName ?? firstNameFrom(nextProfile.name),
    lastName: nextProfile.lastName ?? session?.lastName ?? lastNameFrom(nextProfile.name),
    email: nextProfile.email ?? session?.email
  };
}

function firstNameFrom(name = "") {
  return name.trim().split(/\s+/)[0] ?? "";
}

function lastNameFrom(name = "") {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.length > 1 ? parts.slice(1).join(" ") : "";
}

function splitCsv(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}
