import { v4 as uuidv4 } from 'uuid';

const firstNames = [
  'ana', 'maria', 'joao', 'carlos', 'julio', 'lucas', 'juliana', 'lara', 'paulo', 'camila',
  'gabriel', 'renata', 'danilo', 'amanda', 'ricardo', 'bianca', 'aline', 'diego', 'nathalia',
  'gustavo', 'helena', 'rafael', 'carla', 'fernando', 'patricia', 'matheus', 'luana', 'leonardo',
  'bruna', 'thiago', 'jessica', 'rodrigo', 'isabela', 'anderson', 'larissa', 'felipe', 'stefany',
  'marcelo', 'julia', 'pedro', 'monique', 'andre', 'edson', 'nicolas', 'yasmin', 'davi', 'valeria',
  'roberta', 'rebecca', 'henrique', 'livia', 'marina', 'vitor', 'emanuel', 'elisa', 'kelly', 'vinicius',
  'leticia', 'hugo', 'guilherme', 'sabrina', 'aline', 'mirella', 'flavio', 'tatiane', 'daniela',
  'alessandra', 'cristiane', 'claudia', 'igor', 'geovana', 'murilo', 'anaflavia', 'tais', 'rafaela',
  'luiz', 'breno', 'eduardo', 'priscila', 'eliane', 'sergio', 'cintia', 'ismael', 'tatiana', 'rosana',
  'michele', 'noemi', 'jaqueline', 'luciana', 'darlan', 'katia', 'cauã', 'emanuele', 'rosemary',
  'marcio', 'irene', 'talita', 'caio', 'vanessa', 'alinecristina', 'milena'
];

const lastNames = [
  'silva', 'santos', 'oliveira', 'souza', 'pereira', 'lima', 'almeida', 'ferreira', 'barbosa', 'junior',
  'rodrigues', 'martins', 'melo', 'dias', 'ribeiro', 'castro', 'alves', 'carvalho', 'freitas', 'pires',
  'teixeira', 'correa', 'fernandes', 'nogueira', 'vieira', 'machado', 'bastos', 'goncalves', 'reis',
  'monteiro', 'coelho', 'campos', 'araujo', 'morais', 'cunha', 'costa', 'dantas', 'faria', 'gomes',
  'matos', 'neves', 'peixoto', 'pontes', 'queiroz', 'ramos', 'saraiva', 'soares', 'viana', 'xavier',
  'tavares', 'siqueira', 'macedo', 'prado', 'mendes', 'cardoso', 'farias', 'pinheiro', 'borges',
  'meireles', 'braga', 'valentim', 'benites', 'toledo', 'rangel', 'aguiar', 'caldas', 'damasceno',
  'freire', 'barros', 'guimaraes', 'moreira', 'sousa', 'batista', 'marques', 'paiva', 'magalhaes',
  'fagundes', 'moura', 'vasconcelos', 'bezerra', 'esteves', 'cavalcanti', 'goulart', 'rezende',
  'brandao', 'felix', 'jesus', 'trindade', 'camilo', 'arantes', 'salazar', 'antunes', 'falcao',
  'meneses', 'teles', 'pedrosa', 'maia', 'costa', 'tome'
];

const separators = ['', '_', '.'];

export function maskEmailMiddle(email, startVisible = 4, endVisible = 3) {
    const [user, domain] = email.split('@');

    if (user.length <= startVisible + endVisible) {
        const adjustedStart = Math.max(1, Math.floor(user.length / 2));
        const adjustedEnd = user.length - adjustedStart;

        const start = user.slice(0, adjustedStart);
        const end = user.slice(user.length - adjustedEnd);

        return `${start}***${end}@${domain}`;
    }

    const start = user.slice(0, startVisible);
    const end = user.slice(user.length - endVisible);

    return `${start}***${end}@${domain}`;
}

export function generateFakeRanking(count = 10) {
  const fakeRanking = [];
  const baseTime = 2000;
  const growthFactor = 1.3;

  for (let i = 0; i < count; i++) {
    const id = 9000 + i;
    const guid = uuidv4();
    const uniquePart = guid.split('-')[0];
    const hash = parseInt(uniquePart, 16);
    const seedValue = hash % 1000 / 1000;

    const firstName = firstNames[hash % firstNames.length] || 'lucas';
    const lastName = lastNames[(hash >> 4) % lastNames.length] || 'silva';
    const separator = separators[(hash >> 8) % separators.length] || '';
    const number = (hash % 100).toString().padStart(2, '0');

    // Varia a posição do número no email
    let emailUser = '';
    switch ((hash >> 12) % 4) {
      case 0:
        emailUser = `${firstName}${separator}${lastName}${number}`;
        break;
      case 1:
        emailUser = `${firstName}${number}${separator}${lastName}`;
        break;
      case 2:
        emailUser = `${firstName}${separator}${number}${lastName}`;
        break;
      case 3:
        emailUser = `${number}${firstName}${separator}${lastName}`;
        break;
    }

    const emailFull = `${emailUser}@gmail.com`;
    const email = maskEmailMiddle(emailFull);

    const base = baseTime * Math.pow(growthFactor, i);
    const variation = base * ((seedValue - 0.5) * 0.2);
    const time = Math.floor(base + variation);
    const buttonIndex = Math.floor(seedValue * 8);

    fakeRanking.push({
      id,
      email,
      time,
      buttonIndex
    });
  }

  return fakeRanking;
}
