from pydantic import BaseModel


class DictionaryLookupOut(BaseModel):
    word: str
    translations: str
