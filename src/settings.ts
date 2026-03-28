/** Ключ записи в localStorage (один JSON на всё приложение). */
const STORAGE_KEY = "personae-settings";

/**
 * Пользовательские настройки Personae.
 * По мере роста приложения добавляйте поля сюда и в defaultSettings;
 * для несовместимых изменений схемы заведите version + миграцию при чтении.
 */
export type Settings = {
    /** Куда складывать данные приложения (см. правила проекта: IndexedDB / внешнее API). */
    storageType: "local" | "indexeddb" | "github";
};

/** Значения по умолчанию; при парсинге из хранилища неизвестные поля игнорируйте, недостающие — брать отсюда. */
const defaultSettings: Settings = {
    storageType: "local",
};

/**
 * Доступ к настройкам в браузере без бэкенда.
 * Кэширует объект в памяти после первого getSettings(); при изменении полей вызывайте saveSettings().
 */
class LocalSettings {
    /** Текущий снимок настроек; инициализируется лениво в getSettings(). */
    private static settings: Settings | undefined;

    /**
     * Возвращает актуальные настройки: при первом вызове подмешивает сохранённое из localStorage к defaultSettings.
     * Битый JSON или ошибка парса не ломают приложение — остаются дефолты, ошибка пишется в консоль.
     */

    static getSettings(): Settings {
        if (!LocalSettings.settings) {
            LocalSettings.settings = { ...defaultSettings };
            try {
                const raw = localStorage.getItem(STORAGE_KEY);
                if (raw) {
                    const parsed = JSON.parse(raw) as Partial<Settings>;
                    LocalSettings.settings = { ...LocalSettings.settings, ...parsed };
                }
            } catch (error) {
                console.error("Error loading settings:", error);
            }
        }
        return LocalSettings.settings;
    }

    /**
     * Сохраняет текущий объект настроек в localStorage.
     * Вызывайте после изменения полей getSettings() (тот же объект по ссылке).
     * QuotaExceeded и прочие ошибки только логируются.
     */
    static saveSettings(): void {
        if (!LocalSettings.settings) {
            LocalSettings.settings = { ...defaultSettings };
        }
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(LocalSettings.settings));
        } catch (error) {
            console.error("Error saving settings:", error);
        }
    }

    /**
     * Сброс к defaultSettings, запись в localStorage; удобно для кнопки «Сбросить настройки».
     */
    static restoreDefault(): Settings {
        LocalSettings.settings = { ...defaultSettings };
        LocalSettings.saveSettings();
        return LocalSettings.settings;
    }
}

export default LocalSettings;
