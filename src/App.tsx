import { observer } from "mobx-react-lite";
import { useEffect, useState, type ComponentProps } from "react";
import {
    Box,
    Button,
    Container,
    Content,
    Form,
    Header,
    HStack,
    IconButton,
    Input,
    Sidebar,
    Stack,
    Text,
    Tree,
    Heading,
    useMediaQuery,
    Panel,
} from "rsuite";

import { Codicon } from "./Codicon";
import { UserSettingsDialog } from "./UserSettingsDialog";
import {
    makeBookNavKey,
    NEW_SHELF_TREE_ITEM_VALUE,
    parseBookNavKey,
    dataModel,
    uiStore,
} from "./store";

const NAV_SHELF_ICON = 18;
const NAV_BOOK_ICON = 16;
const HEADER_ACTION_ICON = 22;
const PANEL_TITLE_ICON = 18;

function treeRowIcon(value: string) {
    if (value === NEW_SHELF_TREE_ITEM_VALUE) {
        return <Codicon name="add" size={NAV_SHELF_ICON} />;
    }
    if (value.includes("/")) {
        return <Codicon name="book" size={NAV_BOOK_ICON} />;
    }
    return <Codicon name="folder-library" size={NAV_SHELF_ICON} />;
}

type FormFieldProps = {
    label: string;
    text?: string;
} & ComponentProps<typeof Form.Control> &
    Partial<Omit<ComponentProps<typeof Input>, keyof ComponentProps<typeof Form.Control>>>;

function FormField({ name, label, text, ...controlProps }: FormFieldProps) {
    return (
        <Form.Group controlId={name}>
            <Form.Label>{label}</Form.Label>
            <Form.Control name={name} accepter={Input} {...controlProps} />
            {text ? <Form.Text>{text}</Form.Text> : null}
        </Form.Group>
    );
}

function AppInner() {
    const [settingsOpen, setSettingsOpen] = useState(false);
    const {
        booksBarExpanded: sidebarExpanded,
        personsBarExpanded: rightPanelExpanded,
        editMode,
    } = uiStore;
    const { shelves, booksByShelfId, activeNavKey, navOpenKeys } = dataModel;
    const [isMobile] = useMediaQuery("(max-width: 768px)");
    const isBooksBarExpanded = sidebarExpanded && !isMobile;
    const isPersonsBarExpanded = rightPanelExpanded && !isMobile;

    const parsedNav = parseBookNavKey(activeNavKey);
    const currentShelfId =
        parsedNav?.shelfId ??
        (activeNavKey && !String(activeNavKey).includes("/") ? activeNavKey : "");
    const currentShelfName =
        (currentShelfId ? shelves.find((s) => s.id === currentShelfId)?.name : undefined) ?? "—";

    const currentBook =
        parsedNav != null
            ? (booksByShelfId[parsedNav.shelfId] ?? []).find((b) => b.id === parsedNav.bookId)
            : undefined;
    const currentBookName = currentBook?.name ?? "—";

    /** выбран узел-книга в дереве (ключ `полка/книга`, книга есть в модели) */
    const currentIsBook = Boolean(currentBook);
    /** выбрана только полка (ключ — id полки, без `/`), не псевдо-пункт */
    const currentIsShelf =
        Boolean(activeNavKey) &&
        parsedNav == null &&
        activeNavKey !== NEW_SHELF_TREE_ITEM_VALUE &&
        shelves.some((s) => s.id === activeNavKey);

    const [shelfRenameDraft, setShelfRenameDraft] = useState(currentShelfName);
    useEffect(() => {
        if (currentIsShelf && currentShelfId) {
            setShelfRenameDraft(currentShelfName === "—" ? "" : currentShelfName);
        }
    }, [currentIsShelf, currentShelfId, currentShelfName]);

    const commitShelfRename = () => {
        if (!currentIsShelf || !currentShelfId) return;
        const next = shelfRenameDraft.trim() || "Новая полка";
        if (next === (shelves.find((s) => s.id === currentShelfId)?.name ?? "")) {
            return;
        }
        void dataModel.updateShelfName(currentShelfId, shelfRenameDraft);
    };

    const deleteCurrentShelf = () => {
        if (!currentIsShelf || !currentShelfId) return;
        const title = shelves.find((s) => s.id === currentShelfId)?.name ?? currentShelfId;
        const ok = window.confirm(
            `Удалить полку «${title}»? Все книги на этой полке будут удалены.`,
        );
        if (!ok) return;
        void dataModel.removeShelf(currentShelfId);
    };

    const treeData = [
        ...shelves.map((shelf) => {
            const books = booksByShelfId[shelf.id] ?? [];
            const node: {
                value: string;
                label: string;
                children?: { value: string; label: string }[];
            } = { value: shelf.id, label: shelf.name };
            if (books.length > 0) {
                node.children = books.map((book) => ({
                    value: makeBookNavKey(shelf.id, book.id),
                    label: book.name,
                }));
            }
            return node;
        }),
        ...(editMode ? [{ value: NEW_SHELF_TREE_ITEM_VALUE, label: "Новая полка" }] : []),
    ];

    return (
        <>
            <UserSettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
            <Container style={{ flex: 1, minHeight: 0, height: "100%" }}>
                <Header
                    style={{
                        borderBottom: "1px solid var(--rs-border-primary)",
                        flexShrink: 0,
                        backgroundColor: "var(--rs-bg-card)",
                        backgroundImage: [
                            "linear-gradient(105deg, hsl(210 32% 20% / 0.11) 0%, transparent 42%)",
                            "linear-gradient(90deg, transparent 0%, hsl(38 42% 96% / 0.92) 55%, hsl(32 38% 90% / 0.88) 100%)",
                            "linear-gradient(180deg, hsl(0 0% 100% / 0.35) 0%, transparent 45%)",
                        ].join(", "),
                    }}
                >
                    <HStack align="center" spacing={12} style={{ padding: "8px 16px" }}>
                        <Stack.Item grow={1}>
                            <HStack spacing={24}>
                                <Heading
                                    style={{
                                        margin: 0,
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 10,
                                    }}
                                >
                                    <img
                                        src="/logo.png"
                                        alt=""
                                        decoding="async"
                                        style={{
                                            height: "1em",
                                            width: "auto",
                                            flexShrink: 0,
                                            display: "block",
                                            objectFit: "contain",
                                        }}
                                    />
                                </Heading>
                                <Heading level={4} style={{ margin: 0 }}>
                                    Personae
                                </Heading>
                                {currentIsShelf && (
                                    <Heading level={6} style={{ margin: 0 }}>
                                        {currentShelfName}
                                    </Heading>
                                )}
                                {currentIsBook && (
                                    <Heading level={6} style={{ margin: 0 }}>
                                        {currentBookName}
                                    </Heading>
                                )}
                            </HStack>
                        </Stack.Item>
                        <HStack spacing={6}>
                            <IconButton
                                appearance="subtle"
                                size="sm"
                                toggleable
                                active={sidebarExpanded}
                                onToggle={(next) => uiStore.setBooksBarExpanded(next)}
                                icon={
                                    <Codicon name="layout-sidebar-left" size={HEADER_ACTION_ICON} />
                                }
                                title="Свернуть/развернуть список книг"
                                aria-label="Список книг"
                                aria-pressed={sidebarExpanded}
                            />
                            <IconButton
                                appearance="subtle"
                                size="sm"
                                toggleable
                                active={rightPanelExpanded}
                                onToggle={(next) => uiStore.setPersonsBarExpanded(next)}
                                icon={
                                    <Codicon
                                        name="layout-sidebar-right"
                                        size={HEADER_ACTION_ICON}
                                    />
                                }
                                title="Свернуть/развернуть список персонажей"
                                aria-label="Список персонажей"
                                aria-pressed={rightPanelExpanded}
                            />
                            <IconButton
                                appearance="subtle"
                                size="sm"
                                toggleable
                                active={editMode}
                                onToggle={(next) => uiStore.setEditMode(next)}
                                icon={<Codicon name="edit" size={HEADER_ACTION_ICON} />}
                                title="Включить/выключить режим правки"
                                aria-label="Режим правки"
                                aria-pressed={editMode}
                            />
                            <IconButton
                                appearance="subtle"
                                size="sm"
                                icon={<Codicon name="settings-gear" size={HEADER_ACTION_ICON} />}
                                title="Настройки"
                                aria-label="Настройки"
                                onClick={() => setSettingsOpen(true)}
                            />
                        </HStack>
                    </HStack>
                </Header>
                <Container style={{ flex: 1, minHeight: 0, minWidth: 0, overflow: "hidden" }}>
                    <Sidebar
                        h="100%"
                        width={isBooksBarExpanded ? 400 : 0}
                        collapsible
                        style={{ flex: "none", minHeight: 0, overflow: "hidden" }}
                    >
                        <Box
                            as="section"
                            h="100%"
                            style={{ minHeight: 0, overflow: "auto", padding: 8 }}
                        >
                            <Tree
                                data={treeData}
                                value={activeNavKey}
                                onSelect={(_node, value) => {
                                    const v = value != null ? String(value) : "";
                                    if (v === NEW_SHELF_TREE_ITEM_VALUE) {
                                        void dataModel.addShelf("", true);
                                        return;
                                    }
                                    dataModel.setActiveNavKey(v || undefined);
                                }}
                                expandItemValues={navOpenKeys}
                                onExpand={(nextKeys) =>
                                    dataModel.setNavOpenKeys(nextKeys.map(String))
                                }
                                renderTreeIcon={() => null}
                                renderTreeNode={(node) => (
                                    <HStack align="center" spacing={8} style={{ minWidth: 0 }}>
                                        <span
                                            style={{
                                                flexShrink: 0,
                                                display: "inline-flex",
                                                alignItems: "center",
                                            }}
                                        >
                                            {treeRowIcon(String(node.value))}
                                        </span>
                                        <span
                                            style={{
                                                overflow: "hidden",
                                                textOverflow: "ellipsis",
                                            }}
                                        >
                                            {node.label}
                                        </span>
                                    </HStack>
                                )}
                            />
                        </Box>
                    </Sidebar>
                    <Container style={{ flex: 1, minHeight: 0, minWidth: 0, overflow: "hidden" }}>
                        <Container
                            style={{ flex: 1, minHeight: 0, minWidth: 0, overflow: "hidden" }}
                        >
                            {editMode ? (
                                <Header>
                                    {currentIsShelf && (
                                        <Panel header="Полка" bordered style={{ margin: 12 }}>
                                            <Form
                                                fluid
                                                onSubmit={(_formValue, event) => {
                                                    event?.preventDefault();
                                                    commitShelfRename();
                                                }}
                                            >
                                                <FormField
                                                    name="shelfRenameDraft"
                                                    label="Наименование"
                                                    text="Наименование полки"
                                                    value={shelfRenameDraft}
                                                    onChange={setShelfRenameDraft}
                                                    onBlur={commitShelfRename}
                                                    placeholder="Название полки"
                                                />
                                                <Form.Group>
                                                    <HStack spacing={8} style={{ marginTop: 8 }}>
                                                        <Button
                                                            appearance="primary"
                                                            type="submit"
                                                        >
                                                            Сохранить
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            color="red"
                                                            appearance="ghost"
                                                            onClick={deleteCurrentShelf}
                                                        >
                                                            Удалить
                                                        </Button>
                                                    </HStack>
                                                </Form.Group>
                                            </Form>
                                        </Panel>
                                    )}
                                    {currentIsBook && (
                                        <Box style={{ padding: 12 }}>
                                            <Text>Книга</Text>
                                        </Box>
                                    )}
                                </Header>
                            ) : null}
                            <Content
                                style={{ flex: 1, minHeight: 0, minWidth: 0, overflow: "auto" }}
                            >
                                <Box style={{ padding: 12 }}>
                                    <Text>{"Hello, world! ".repeat(1000)}</Text>
                                </Box>
                            </Content>
                        </Container>
                        <Sidebar
                            h="100%"
                            width={isPersonsBarExpanded ? 400 : 0}
                            collapsible
                            style={{ flex: "none", minHeight: 0, overflow: "hidden" }}
                        >
                            <Box
                                as="section"
                                h="100%"
                                style={{ minHeight: 0, overflow: "auto", padding: 8 }}
                            >
                                <HStack align="center" spacing={8} style={{ marginBottom: 8 }}>
                                    <Codicon name="account" size={PANEL_TITLE_ICON} />
                                    <Heading level={4} style={{ margin: 0 }}>
                                        Персонажи
                                    </Heading>
                                </HStack>
                                <Text>{"Hello, AI Assistant! ".repeat(1000)}</Text>
                            </Box>
                        </Sidebar>
                    </Container>
                </Container>
            </Container>
        </>
    );
}

export const App = observer(AppInner);
