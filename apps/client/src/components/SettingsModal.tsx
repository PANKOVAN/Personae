import type { AppStore } from "../store/appStore";
import { settings } from "../settings";
import { observer } from "mobx-react-lite";
import { useEffect, useState } from "react";
import { Button, Form, Input, Modal, Stack } from "rsuite";

type Props = { store: AppStore };

export const SettingsModal = observer(function SettingsModal({ store }: Props) {
    const open = store.settingsOpen;
    const [serverURL, setServerURL] = useState("");
    const [storageRoot, setStorageRoot] = useState("");

    useEffect(() => {
        if (open) {
            setServerURL(settings.serverURL);
            setStorageRoot(settings.storageRoot);
        }
    }, [open]);

    const save = () => {
        settings.serverURL = serverURL.trim() || "http://localhost:3000";
        settings.storageRoot = storageRoot.trim() || "data";
        store.closeSettings();
        void store.init();
    };

    return (
        <Modal open={open} onClose={() => store.closeSettings()} size="sm">
            <Modal.Header>
                <Modal.Title>Настройки</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <Form fluid>
                    <Stack spacing={16}>
                        <Form.Group controlId="settings-server-url">
                            <Form.ControlLabel>URL сервера API</Form.ControlLabel>
                            <Input value={serverURL} onChange={(v) => setServerURL(v)} placeholder="http://localhost:3000" />
                            <Form.HelpText>Используется для проверки /api/health.</Form.HelpText>
                        </Form.Group>
                        <Form.Group controlId="settings-storage-root">
                            <Form.ControlLabel>Папка хранилища (справочно)</Form.ControlLabel>
                            <Input value={storageRoot} onChange={(v) => setStorageRoot(v)} placeholder="data" />
                            <Form.HelpText>Пока только подсказка; корень задаётся на сервере.</Form.HelpText>
                        </Form.Group>
                    </Stack>
                </Form>
            </Modal.Body>
            <Modal.Footer>
                <Button onClick={() => store.closeSettings()} appearance="subtle">
                    Отмена
                </Button>
                <Button onClick={save} appearance="primary">
                    Сохранить
                </Button>
            </Modal.Footer>
        </Modal>
    );
});
