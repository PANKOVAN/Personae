import { makeAutoObservable } from "mobx";

export class UiStore {
    booksBarExpanded = true;
    /** правая панель (персонажи и т.п.), когда появится в вёрстке */
    personsBarExpanded = true;
    /** режим правки контента */
    editMode = false;

    constructor() {
        makeAutoObservable(this);
    }

    setBooksBarExpanded(value: boolean): void {
        this.booksBarExpanded = value;
    }

    setPersonsBarExpanded(value: boolean): void {
        this.personsBarExpanded = value;
    }

    setEditMode(value: boolean): void {
        this.editMode = value;
    }
}

export const uiStore = new UiStore();
