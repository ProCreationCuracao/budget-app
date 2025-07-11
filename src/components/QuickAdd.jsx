// src/components/QuickAdd.jsx
import React, { useState, useEffect, useRef } from 'react';
import {
  IconButton,
  useDisclosure,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  ModalFooter,
  FormControl,
  FormLabel,
  Input,
  Select,
  Textarea,
  HStack,
  Button,
  VStack,
  RadioGroup,
  Radio,
  Box,
  useToast
} from '@chakra-ui/react';
import { FiPlus } from 'react-icons/fi';
import { supabase } from '../supabaseClient';

export default function QuickAdd({ user, refreshTransactions, refreshAccounts }) {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const initialRef = useRef();
  const toast = useToast();

  const [type, setType] = useState('expense');
  const [accounts, setAccounts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [fromAccount, setFromAccount] = useState('');
  const [toAccount, setToAccount] = useState('');
  const [category, setCategory] = useState('');
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState('');

  // Fetch accounts and categories
  useEffect(() => {
    (async () => {
      const { data: accData } = await supabase
        .from('accounts')
        .select('id, name')
        .eq('user_id', user.id);
      setAccounts(accData || []);
      if (accData && accData.length) setFromAccount(accData[0].id);

      const { data: catData } = await supabase
        .from('categories')
        .select('id, name, type')
        .eq('user_id', user.id);
      setCategories(catData || []);
      // set default category of first matching type
      const defaultCat = catData?.find(c => c.type === type);
      if (defaultCat) setCategory(defaultCat.id);
    })();
  }, [user.id, type]);

  const handleSubmit = async e => {
    e.preventDefault();
    // Basic validation
    if (type === 'transfer' && fromAccount === toAccount) {
      return toast({
        title: 'Transfer Error',
        description: 'From and To accounts must differ.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }

    try {
      const payload = {
        user_id: user.id,
        type,
        amount: parseFloat(amount),
        date,
        category_id: category,
        label,
        note,
      };
      if (type === 'transfer') {
        payload.from_account = fromAccount;
        payload.to_account = toAccount;
      } else {
        payload.account_id = fromAccount;
      }

      await supabase.from('transactions').insert([payload]);
      toast({
        title: 'Added',
        description: `${type.charAt(0).toUpperCase() + type.slice(1)} recorded.`,
        status: 'success',
        duration: 2000,
        isClosable: true,
      });
      refreshTransactions();
      refreshAccounts();
      onClose();
      setAmount(''); setLabel(''); setNote('');
    } catch (err) {
      toast({
        title: 'Error',
        description: err.message,
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  return (
    <>
      <IconButton
        position="fixed"
        bottom="6"
        right="6"
        size="lg"
        colorScheme="teal"
        icon={<FiPlus />}
        onClick={onOpen}
        aria-label="Quick Add"
      />

      <Modal
        isOpen={isOpen}
        onClose={onClose}
        isCentered
        initialFocusRef={initialRef}
      >
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Quick Add</ModalHeader>
          <ModalCloseButton />
          <Box as="form" onSubmit={handleSubmit}>
            <ModalBody>
              <VStack spacing={4} align="stretch">
                <FormControl>
                  <FormLabel>Type</FormLabel>
                  <RadioGroup onChange={setType} value={type}>
                    <HStack spacing={4}>
                      <Radio value="expense">Expense</Radio>
                      <Radio value="income">Income</Radio>
                      <Radio value="transfer">Transfer</Radio>
                    </HStack>
                  </RadioGroup>
                </FormControl>

                <FormControl>
                  <FormLabel>{type === 'transfer' ? 'From Account' : 'Account'}</FormLabel>
                  <Select
                    value={fromAccount}
                    onChange={e => setFromAccount(e.target.value)}
                    required
                  >
                    {accounts.map(acc => (
                      <option key={acc.id} value={acc.id}>{acc.name}</option>
                    ))}
                  </Select>
                </FormControl>

                {type === 'transfer' && (
                  <FormControl>
                    <FormLabel>To Account</FormLabel>
                    <Select
                      value={toAccount}
                      onChange={e => setToAccount(e.target.value)}
                      required
                    >
                      {accounts.map(acc => (
                        <option key={acc.id} value={acc.id}>{acc.name}</option>
                      ))}
                    </Select>
                  </FormControl>
                )}

                <FormControl>
                  <FormLabel>Category</FormLabel>
                  <Select
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    required
                  >
                    {categories
                      .filter(c => c.type === type)
                      .map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                  </Select>
                </FormControl>

                <FormControl>
                  <FormLabel>Label</FormLabel>
                  <Input
                    value={label}
                    onChange={e => setLabel(e.target.value)}
                    placeholder="Optional label"
                  />
                </FormControl>

                <FormControl>
                  <FormLabel>Amount</FormLabel>
                  <Input
                    ref={initialRef}
                    type="number"
                    step="0.01"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    required
                  />
                </FormControl>

                <FormControl>
                  <FormLabel>Date</FormLabel>
                  <Input
                    type="date"
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    required
                  />
                </FormControl>

                <FormControl>
                  <FormLabel>Note</FormLabel>
                  <Textarea
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    placeholder="Optional note"
                  />
                </FormControl>
              </VStack>
            </ModalBody>

            <ModalFooter>
              <Button variant="outline" mr={3} onClick={onClose}>
                Cancel
              </Button>
              <Button colorScheme="teal" type="submit">
                Add
              </Button>
            </ModalFooter>
          </Box>
        </ModalContent>
      </Modal>
    </>
  );
}
