// All projects, one JSON file each in ./projects/ (see ./projects/README.md),
// sorted by their `order` field. Adding a file adds a project and its cartridge.

const files = import.meta.glob('./projects/*.json', { eager: true, import: 'default' });

const projects = Object.values(files).sort((a, b) => a.order - b.order);

export default projects;
