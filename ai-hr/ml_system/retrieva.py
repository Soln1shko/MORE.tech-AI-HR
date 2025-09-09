from typing import Any, Dict, List, Optional
import chromadb
from langchain_huggingface import HuggingFaceEmbeddings
import logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s [%(name)s] %(message)s")
logger = logging.getLogger(__name__)

logging.getLogger("chromadb.telemetry").setLevel(logging.ERROR)
logging.getLogger("chromadb.telemetry.product.posthog").setLevel(logging.ERROR)
logging.getLogger("urllib3.connectionpool").setLevel(logging.ERROR)
logging.getLogger("backoff").setLevel(logging.CRITICAL)
logging.getLogger("backoff").propagate = False
logging.getLogger("backoff").handlers.clear()
logging.getLogger("httpx").setLevel(logging.WARNING)


class ChromaDBVectorStore:
    """
    Обёртка над ChromaDB для векторного поиска вопросов.

    Использует временный клиент (in-memory) и коллекцию с косинусной метрикой.
    Предоставляет методы добавления документов и семантического поиска.
    """
    
    def __init__(self, persist_directory: str = "./chroma_db", collection_name: str = "interview_knowledge") -> None:
        self.collection_name = collection_name
        
        logger.info("Инициализация ChromaDB...")
        try:
            import os
            os.environ['CHROMA_CLIENT_TIMEOUT'] = '300'
            os.environ['HTTPX_TIMEOUT'] = '300'
            
            self.client = chromadb.EphemeralClient()
            self.collection = self.client.get_or_create_collection(
                name=collection_name,
                metadata={"hnsw:space": "cosine"}
            )
            logger.info("ChromaDB успешно инициализирован (временная БД в памяти)")
            
        except Exception as e:
            logger.exception(f"Критическая ошибка ChromaDB: {e}")
            raise
    
    def add_documents(self, documents: List[str], metadatas: List[Dict[str, Any]], ids: List[str]) -> None:
        """
        Добавляет документы в коллекцию.

        Args:
            documents: Список текстов документов.
            metadatas: Список словарей с метаданными для каждого документа.
            ids: Список уникальных идентификаторов документов.
        """
        try:
            self.collection.add(
                documents=documents,
                metadatas=metadatas,
                ids=ids
            )
            logger.info(f"Добавлено {len(documents)} документов в коллекцию '{self.collection_name}'")
        except Exception as e:
            logger.exception(f"Ошибка при добавлении документов: {e}")
            raise
    
    def query(self, query_text: str, n_results: int = 5, where_filter: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Выполняет семантический поиск по коллекции.

        Args:
            query_text: Текст запроса.
            n_results: Количество результатов.
            where_filter: Фильтр по метаданным (опционально).

        Returns:
            Словарь с полями `documents`, `metadatas`, `distances`.
        """
        try:
            results = self.collection.query(
                query_texts=[query_text],
                n_results=n_results,
                where=where_filter
            )
            return results
        except Exception as e:
            logger.exception(f"Ошибка при поиске: {e}")
            return {"documents": [[]], "metadatas": [[]], "distances": [[]]}


class InterviewKnowledgeSystemHF:
    """
    Система знаний интервьюера на базе HuggingFace Embeddings и ChromaDB.

    Подготавливает текстовые документы (вопросы/ответы), эмбеддит их и помещает
    в векторное хранилище; предоставляет семантический поиск по базе знаний.
    """
    
    def __init__(
        self,
        persist_directory: str = "./interview_db",
        model_name: str = "sentence-transformers/all-MiniLM-L6-v2",
        collection_name: str = "interview_questions_hf",
    ) -> None:
        """Инициализирует подсистему знаний на базе HuggingFace и ChromaDB.

        Args:
            persist_directory: Путь к директории хранилища ChromaDB.
            model_name: Имя модели HuggingFace для генерации эмбеддингов.
            collection_name: Название коллекции ChromaDB.
        """
        logger.info(f"Инициализация HuggingFace модели: {model_name}")
        logger.info("Первый запуск может занять время для загрузки модели...")
        
        model_kwargs = {
            'device': 'cpu',
            'model_kwargs': {
                'trust_remote_code': True
            }
        }
        
        encode_kwargs = {
            'normalize_embeddings': True,
            'batch_size': 32
        }
        
        self.embeddings = HuggingFaceEmbeddings(
            model_name=model_name,
            model_kwargs=model_kwargs,
            encode_kwargs=encode_kwargs,
            show_progress=True
        )
        
        self.vector_store = ChromaDBVectorStore(
            persist_directory=persist_directory,
            collection_name=collection_name
        )
        
        logger.info("Система инициализирована успешно!")

    def add_knowledge_to_rag(self, chunks: List[Dict[str, Any]]) -> None:
        """Добавляет фрагменты знаний в векторное хранилище RAG.

        Args:
            chunks: Элементы с ожидаемыми ключами: section (раздел/тема), question (вопрос).
        """
        documents = []
        metadatas = []
        ids = []
        
        for i, chunk in enumerate(chunks):
            section = chunk.get('section', '').strip()
            question = chunk.get('question', '').strip()
            if not section or not question:
                continue

            doc_text = f"Секция: {section}\nВопрос: {question}"
            
            documents.append(doc_text.strip())
            metadatas.append({
                "section": section,
                "question": question
            })
            ids.append(f"question_{i}_{section}")
        
        self.vector_store.add_documents(documents, metadatas, ids)

    def search_questions(self, query: str, grade: Optional[str] = None, section: Optional[str] = None, k: int = 3) -> List[Dict[str, Any]]:
        """Выполняет семантический поиск релевантных вопросов.

        Args:
            query: Текст запроса (тема или конкретизация).
            grade: Фильтр по уровню сложности (опционально).
            section: Фильтр по разделу/секции (опционально).
            k: Количество возвращаемых результатов.

        Returns:
            Список словарей с полями `content`, `metadata`, `distance`.
        """
        where_filter: Dict[str, Any] = {}
        if grade:
            where_filter["grade"] = grade
        if section:
            where_filter["section"] = section
        
        results = self.vector_store.query(
            query_text=query,
            n_results=k,
            where_filter=where_filter if where_filter else None
        )
        
        return self._format_search_results(results)

    def _format_search_results(self, results: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Приводит ответ ChromaDB к унифицированному виду.

        Args:
            results: Сырые результаты запроса из ChromaDB.

        Returns:
            Список словарей с полями: content, metadata, distance.
        """
        formatted_results: List[Dict[str, Any]] = []
        
        if results['documents'] and results['documents'][0]:
            for i, doc in enumerate(results['documents'][0]):
                result = {
                    'content': doc,
                    'metadata': results['metadatas'][0][i] if results['metadatas'][0] else {},
                    'distance': results['distances'][0][i] if 'distances' in results and results['distances'][0] else None
                }
                formatted_results.append(result)
        
        return formatted_results


class InterviewAssistantHF:
    """
    Помощник интервьюера, использующий `InterviewKnowledgeSystemHF` для поиска знаний.

    Инкапсулирует типичные операции: подбор вопросов по теме, дополнительные вопросы,
    а также упрощенную «оценку» ответа (эвристическая заглушка на основе поиска).
    """
    
    def __init__(self, knowledge_system: InterviewKnowledgeSystemHF) -> None:
        self.knowledge_system = knowledge_system
        
    def get_questions_for_topic(self, topic: str, count: int = 3) -> List[Dict[str, Any]]:
        """
        Возвращает релевантные вопросы по теме, используя только поля `question` и `section`.

        Args:
            topic: Тема (запрос) для поиска.
            count: Максимальное число результатов.

        Returns:
            Список словарей вида {"content": <question>, "metadata": {"section": <section>, "question": <question>}, "distance": <float|None>}.
            Включаются только элементы, у которых присутствуют и `question`, и `section`.
        """
        raw_results: List[Dict[str, Any]] = self.knowledge_system.search_questions(topic, grade=None, k=max(count * 3, count))

        filtered: List[Dict[str, Any]] = []
        for item in raw_results or []:
            meta = item.get("metadata", {}) if isinstance(item, dict) else {}
            question_text = meta.get("question") or item.get("content")
            section = meta.get("section")
            if question_text and section:
                filtered.append({
                    "content": question_text,
                    "metadata": {"section": section, "question": question_text},
                    "distance": item.get("distance") if isinstance(item, dict) else None,
                })
            if len(filtered) >= count:
                break

        return filtered
    
    def get_follow_up_questions(self, current_question: str, candidate_answer: str) -> List[str]:
        """
        Пытается найти в базе знания дополнительные вопросы, релевантные текущему вопросу.

        Args:
            current_question: Текущий заданный вопрос.
            candidate_answer: Ответ кандидата (используется как контекст).

        Returns:
            Перечень укороченных дополнительных вопросов (до 5).
        """
        query = f"углубление вопроса {current_question} дополнительные вопросы"
        results = self.knowledge_system.search_questions(query, k=2)
        
        follow_ups = []
        for result in results:
            content = result['content']
            if "Дополнительные вопросы:" in content:
                questions_part = content.split("Дополнительные вопросы:")[-1].strip()
                questions = [q.strip() for q in questions_part.split('\n') if q.strip()]
                follow_ups.extend(questions[:3])
        
        return follow_ups[:5]
    
    def assess_answer_quality(self, question: str, candidate_answer: str, target_grade: str) -> Dict[str, Any]:
        """
        Эвристическая попытка сформировать оценку качества ответа.

        Выполняет поиск по базе знаний с учетом целевого уровня и строит упрощенный отчет.

        Args:
            question: Исходный вопрос.
            candidate_answer: Ответ кандидата.
            target_grade: Целевой уровень сложности.

        Returns:
            Сводная структура: совпадения по уровню, найденные «красные флаги»,
            недостающие пункты, рекомендованные уточняющие вопросы.
        """
        query = f"оценка ответа {question} критерии {target_grade}"
        results = self.knowledge_system.search_questions(query, grade=target_grade, k=1)
        
        if not results:
            return {
                'grade_match': 'Недостаточно данных',
                'red_flags_found': [],
                'missing_key_points': [],
                'recommended_follow_ups': []
            }

        red_flags_found = []
        if "не знает" in candidate_answer.lower():
            red_flags_found.append("Кандидат не знает основ")
        
        assessment = {
            'grade_match': f"Найден релевантный контент для {target_grade}",
            'red_flags_found': red_flags_found,
            'missing_key_points': [],
            'recommended_follow_ups': self.get_follow_up_questions(question, candidate_answer)[:3]
        }
        
        return assessment
