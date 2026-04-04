class Settings {
    get serverURL() {
        return localStorage.getItem("personae_serverURL") || "http://localhost:3000";
    }
    set serverURL(value: string) {
        localStorage.setItem("personae_serverURL", value);
    }
    get storageRoot() {
        return localStorage.getItem("personae_storageRoot") || "data";
    }
    set storageRoot(value: string) {
        localStorage.setItem("personae_storageRoot", value);
    }
}
export const settings = new Settings();
